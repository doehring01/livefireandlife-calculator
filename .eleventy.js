module.exports = function(eleventyConfig) {
  // Assets (images, CSS inside /assets, etc.)
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // Copy ONLY JS files from calculators (not HTML) so Eleventy still builds pages.
  // This will include take-home-pay-script.js AND take-home-pay-toggle.js
  eleventyConfig.addPassthroughCopy({ "src/calculators/*.js": "calculators" });

  return {
    dir: {
      input: "src",
      output: "dist"
    }
  };
};
module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/calculators/take-home-pay-toggle.js": "calculators/take-home-pay-toggle.js" });

  // NEW: pass the legal footer helper through to the site root
  eleventyConfig.addPassthroughCopy({ "src/legal-footer.js": "legal-footer.js" });

  return { dir: { input: "src", output: "dist" } };
};
