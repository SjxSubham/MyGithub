import passport from "passport";
import dotenv from "dotenv";
import { Strategy as GitHubStrategy } from "passport-github2";
import User from "../models/user.model.js";
dotenv.config();
passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

// Use the GitHubStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and GitHub
//   profile), and invoke a callback with a user object.
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "https://mygithubapp.onrender.com/api/auth/github/callback",
    },
    async function (accessToken, refreshToken, profile, done) {
      // asynchronous verification, for effect...
      try {
        const user = await User.findOne({ username: profile.username });
        if (!user) {
          const newUser = new User({
            name: profile.displayName || "",
            username: profile.username,
            profileUrl: profile.profileUrl,
            avatarUrl:
              profile.photos && profile.photos.length > 0
                ? profile.photos[0].value
                : null,
            likedProfiles: [],
            likedBy: [],
          });
          await newUser.save();
          done(null, newUser);
        } else {
          // Update avatar URL if it's missing and now available
          if (!user.avatarUrl && profile.photos && profile.photos.length > 0) {
            user.avatarUrl = profile.photos[0].value;
            await user.save();
          }
          done(null, user);
        }
      } catch (error) {
        done(error);
      }
    },
  ),
);
