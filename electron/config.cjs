/* Desktop-only settings. The website does not read this file.
 * apiOrigin = where the REAL Narx.top backend (Express + MongoDB) lives. The .exe forwards every "/api/..." call
 * there, so prices/accounts come from the same server as the website. Override at run time with NARX_API_ORIGIN. */
module.exports = {
  // Your live site. narx.top and www.narx.top both work (redirects between them are followed).
  apiOrigin: "https://www.narx.top",
};
