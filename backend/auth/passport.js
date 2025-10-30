import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

export default function (passportInstance) {
  // serialize/deserialize (we won't use session except for handshake)
  passportInstance.serializeUser((user, done) => done(null, user.id));
  passportInstance.deserializeUser(async (id, done) => {
    const user = await User.findById(id);
    done(null, user);
  });

  // GOOGLE
  passportInstance.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL ,
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
            let username = profile.displayName.toLowerCase().replace(/\s+/g, '');
            const usernameExists = await User.findOne({ username });
            if (usernameExists) {
              username = `${username}${Math.floor(Math.random() * 10000)}`;
            }

            user = await User.create({
              provider: "google",
              providerId: profile.id,
              email,
              username: username,
              name: profile.displayName,
              avatar: profile.photos?.[0]?.value,
              hasSubdomain: false,
              customDomainState: 'none',
              membershipStatus: false,
            });
          } else if (!user.providerId) {
            // link existing local user by email
            user.provider = "google";
            user.providerId = profile.id;
            user.avatar = user.avatar || profile.photos?.[0]?.value;
            await user.save();
          }

          return done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );

  // FACEBOOK
//   passportInstance.use(
//     new FacebookStrategy(
//       {
//         clientID: process.env.FACEBOOK_APP_ID,
//         clientSecret: process.env.FACEBOOK_APP_SECRET,
//         callbackURL:
//           process.env.FACEBOOK_CALLBACK_URL || "/auth/facebook/callback",
//         profileFields: ["id", "displayName", "photos", "email"],
//         passReqToCallback: true,
//       },
//       async (req, accessToken, refreshToken, profile, done) => {
//         try {
//           const email = profile.emails?.[0]?.value;
//           let user =
//             (await User.findOne({
//               provider: "facebook",
//               providerId: profile.id,
//             })) ||
//             (email && (await User.findOne({ email })));

//           if (!user) {
//             user = await User.create({
//               provider: "facebook",
//               providerId: profile.id,
//               email,
//               name: profile.displayName,
//               avatar: profile.photos?.[0]?.value,
//             });
//           } else if (!user.providerId) {
//             user.provider = "facebook";
//             user.providerId = profile.id;
//             user.avatar = user.avatar || profile.photos?.[0]?.value;
//             await user.save();
//           }

//           return done(null, user);
//         } catch (err) {
//           done(err);
//         }
//       }
//     )
//   );
};
