import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  firebaseAuth,
  getFriendlyAuthError,
  googleAuthProvider,
  isFirebaseConfigured,
} from '../config/firebase.js';
import { setAuthTokenProvider } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const registeringRef = useRef(false);

  useEffect(() => {
    setAuthTokenProvider(async () => {
      if (!firebaseAuth?.currentUser) return null;
      return firebaseAuth.currentUser.getIdToken();
    });

    if (!isFirebaseConfigured || !firebaseAuth) {
      setAuthLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (registeringRef.current && firebaseUser) {
        return;
      }
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || firebaseUser.email || 'CampusX Student',
          photoURL: firebaseUser.photoURL || '',
          emailVerified: firebaseUser.emailVerified,
        });
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const ensureConfigured = () => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      throw new Error(
        'Firebase Web configuration is missing. Add VITE_FIREBASE_* keys to frontend/.env and restart Vite.'
      );
    }
  };

  const signInWithEmail = async ({ email, password, rememberMe = true }) => {
    ensureConfigured();
    try {
      await setPersistence(
        firebaseAuth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );
      const cred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      return cred.user;
    } catch (err) {
      throw new Error(getFriendlyAuthError(err));
    }
  };

  const registerWithEmail = async ({ fullName, email, password }) => {
    ensureConfigured();
    registeringRef.current = true;
    try {
      await setPersistence(firebaseAuth, browserLocalPersistence);
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      const cleanName = fullName.trim();
      if (cleanName) {
        await updateProfile(cred.user, { displayName: cleanName });
      }
      setUser({
        uid: cred.user.uid,
        email: cred.user.email || email.trim(),
        displayName: cleanName || cred.user.email || 'CampusX Student',
        photoURL: cred.user.photoURL || '',
        emailVerified: cred.user.emailVerified,
      });
      setAuthLoading(false);
      return cred.user;
    } catch (err) {
      throw new Error(getFriendlyAuthError(err));
    } finally {
      registeringRef.current = false;
    }
  };

  const signInWithGoogle = async ({ rememberMe = true } = {}) => {
    ensureConfigured();
    try {
      await setPersistence(
        firebaseAuth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );
      const cred = await signInWithPopup(firebaseAuth, googleAuthProvider);
      return cred.user;
    } catch (err) {
      throw new Error(getFriendlyAuthError(err));
    }
  };

  const resetPassword = async (email) => {
    ensureConfigured();
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
    } catch (err) {
      throw new Error(getFriendlyAuthError(err));
    }
  };

  const logout = async () => {
    if (!firebaseAuth) {
      setUser(null);
      return;
    }
    await signOut(firebaseAuth);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        isFirebaseConfigured,
        signInWithEmail,
        registerWithEmail,
        signInWithGoogle,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }
  return ctx;
}
