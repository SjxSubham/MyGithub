const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }

  // For API requests, return a JSON response with 401 status
  if (req.xhr || req.headers.accept?.includes("json")) {
    return res.status(401).json({ error: "Unauthorized. Please login first." });
  }

  // For regular requests, redirect to login page
  res.redirect(process.env.CLIENT_BASE_URL + "/login");
};

export default ensureAuthenticated;
