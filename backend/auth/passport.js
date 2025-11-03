import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import User from '../models/User.js';

export default function (passportInstance) {
  // serialize/deserialize (we won't use session except for handshake)
  passportInstance.serializeUser((user, done) => done(null, user.id));
  passportInstance.deserializeUser(async (id, done) => {
    const user = await User.findById(id);
    done(null, user);
  });

  // GOOGLE
  if (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CALLBACK_URL
  ) {
    passportInstance.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL,
          passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            let user =
              (await User.findOne({
                provider: "google",
                providerId: profile.id,
              })) ||
              (email && (await User.findOne({ email })));

            if (!user) {
              // Create a unique username if displayName already exists
              let username = profile.displayName
                ? profile.displayName.toLowerCase().replace(/\s+/g, '')
                : `reader${Math.floor(Math.random() * 10000)}`;
              const usernameExists = await User.findOne({ username });
              if (usernameExists) {
                username = `${username}${Math.floor(Math.random() * 10000)}`;
              }

              user = await User.create({
                provider: "google",
                providerId: profile.id,
                email,
                username,
                name: profile.displayName,
                avatar: profile.photos?.[0]?.value,
                isEmailVerified: true,
                hasSubdomain: false,
                customDomainState: 'none',
                membershipStatus: false,
                lastLogin: new Date(),
              });
            } else if (!user.providerId) {
              // link existing local user by email
              user.provider = "google";
              user.providerId = profile.id;
              user.avatar = user.avatar || profile.photos?.[0]?.value;
              if (!user.isEmailVerified) {
                user.isEmailVerified = true;
              }
              user.lastLogin = new Date();
              await user.save();
            } else {
              user.lastLogin = new Date();
              await user.save();
            }

            return done(null, user);
          } catch (err) {
            done(err);
          }
        }
      )
    );
  } else {
    console.warn(
      "Google OAuth environment variables are missing. Google login will be disabled."
    );
  }

  if (
    process.env.FACEBOOK_APP_ID &&
    process.env.FACEBOOK_APP_SECRET &&
    process.env.FACEBOOK_CALLBACK_URL
  ) {
    passportInstance.use(
      new FacebookStrategy(
        {
          clientID: process.env.FACEBOOK_APP_ID,
          clientSecret: process.env.FACEBOOK_APP_SECRET,
          callbackURL: process.env.FACEBOOK_CALLBACK_URL,
          profileFields: ["id", "displayName", "photos", "email"],
          passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            const rawEmail = profile.emails?.[0]?.value;
            const fallbackEmail = rawEmail || `${profile.id}@facebook.local`;
            const email = fallbackEmail.toLowerCase();

            let user =
              (await User.findOne({
                provider: "facebook",
                providerId: profile.id,
              })) || (await User.findOne({ email }));

            if (!user) {
              let usernameSource = profile.displayName
                ? profile.displayName
                : `reader${Math.floor(Math.random() * 10000)}`;
              let username = usernameSource.toLowerCase().replace(/\s+/g, "");
              if (!username) {
                username = `reader${Math.floor(Math.random() * 10000)}`;
              }

              const usernameExists = await User.findOne({ username });
              if (usernameExists) {
                username = `${username}${Math.floor(Math.random() * 10000)}`;
              }

              user = await User.create({
                provider: "facebook",
                providerId: profile.id,
                email,
                username,
                name: profile.displayName,
                avatar: profile.photos?.[0]?.value,
                isEmailVerified: true,
                hasSubdomain: false,
                customDomainState: 'none',
                membershipStatus: false,
                lastLogin: new Date(),
              });
            } else if (!user.providerId) {
              user.provider = "facebook";
              user.providerId = profile.id;
              user.avatar = user.avatar || profile.photos?.[0]?.value;
              if (!user.email) {
                user.email = email;
              }
              if (!user.isEmailVerified) {
                user.isEmailVerified = true;
              }
              user.lastLogin = new Date();
              await user.save();
            } else {
              user.lastLogin = new Date();
              await user.save();
            }

            return done(null, user);
          } catch (err) {
            done(err);
          }
        }
      )
    );
  } else {
    console.warn(
      "Facebook OAuth environment variables are missing. Facebook login will be disabled."
    );
  }

};
