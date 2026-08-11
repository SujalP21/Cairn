// Importing this barrel registers every schema with Mongoose.
//
// Populating a `ref` requires the target model to be registered, which only
// happens when its module is loaded. Relying on some controller happening to
// import it makes `.populate()` fail the moment that import is tidied away, so
// the server loads all models explicitly at startup instead.
export { default as User } from "./userModel";
export { default as Repository } from "./repoModel";
export { default as Issue } from "./issueModel";
export { default as RefreshToken } from "./refreshTokenModel";
