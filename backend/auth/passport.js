import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';
import {
  buildDisplayName,
  generateUniqueUsername,
  normalizeEmail,
} from '../utils/userUtils.js';
import { initializeSeedData } from '../utils/seed.js';
import { ensureUserSettings } from '../utils/settingsUtils.js';

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
              ensureUserSettings(user).catch(() => {});
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

            await ensureUserSettings(user).catch(() => {});
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

};
