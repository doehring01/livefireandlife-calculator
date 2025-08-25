// .eleventy.js
module.exports = function (eleventyConfig) {
  // --- Passthroughs ---
  // assets (images, logos, etc.)
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // sitewide CSS -> /styles.css
  eleventyConfig.addPassthroughCopy({ "src/styles.css": "styles.css" });

  // favicon / robots (optional: add if you have them)
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });
  // eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });

  // legal footer helper
  eleventyConfig.addPassthroughCopy({ "src/legal-footer.js": "legal-footer.js" });

  // calculators: copy ONLY JS files (let 11ty render the HTML pages)
  eleventyConfig.addPassthroughCopy({ "src/calculators/**/*.js": "calculators" });

  // Watch CSS so local dev hot-reloads styles quickly
  eleventyConfig.addWatchTarget("src/styles.css");

  return {
    dir: {
      input: "src",
      output: "dist"
    }
  };
};
