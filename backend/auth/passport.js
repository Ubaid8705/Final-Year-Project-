import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import User from '../models/User.js';
import {
  buildDisplayName,
  generateUniqueUsername,
  normalizeEmail,
} from '../utils/userUtils.js';
import { initializeSeedData } from '../utils/seed.js';

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
            let email = normalizeEmail(profile.emails?.[0]?.value);
            if (!email) {
              email = normalizeEmail(`${profile.id}@google.local`);
            }
            let user =
              (await User.findOne({
                provider: "google",
                providerId: profile.id,
              })) ||
              (email && (await User.findOne({ email })));

            if (!user) {
              const displayName = buildDisplayName(email, profile.displayName);
              const username = await generateUniqueUsername(email, displayName);

              user = await User.create({
                provider: "google",
                providerId: profile.id,
                email,
                username,
                name: displayName,
                avatar: profile.photos?.[0]?.value,
                isEmailVerified: true,
                hasSubdomain: false,
                customDomainState: 'none',
                membershipStatus: false,
                pronouns: [],
                topics: [],
                lastLogin: new Date(),
              });

              initializeSeedData().catch(() => {});
            } else if (!user.providerId) {
              // link existing local user by email
              user.provider = "google";
              user.providerId = profile.id;
              user.avatar = user.avatar || profile.photos?.[0]?.value;
              user.name = user.name || buildDisplayName(email, profile.displayName);
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
            const email = normalizeEmail(fallbackEmail);

            let user =
              (await User.findOne({
                provider: "facebook",
                providerId: profile.id,
              })) || (await User.findOne({ email }));

            if (!user) {
              const displayName = buildDisplayName(email, profile.displayName);
              const username = await generateUniqueUsername(email, displayName);

              user = await User.create({
                provider: "facebook",
                providerId: profile.id,
                email,
                username,
                name: displayName,
                avatar: profile.photos?.[0]?.value,
                isEmailVerified: true,
                hasSubdomain: false,
                customDomainState: 'none',
                membershipStatus: false,
                pronouns: [],
                topics: [],
                lastLogin: new Date(),
              });

              initializeSeedData().catch(() => {});
            } else if (!user.providerId) {
              user.provider = "facebook";
              user.providerId = profile.id;
              user.avatar = user.avatar || profile.photos?.[0]?.value;
              if (!user.email) {
                user.email = email;
              }
              if (!user.name) {
                user.name = buildDisplayName(email, profile.displayName);
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
