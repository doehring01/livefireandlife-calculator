// .eleventy.js
module.exports = function (eleventyConfig) {
  // --- Passthroughs ---

  // 1) Sitewide CSS now at project root -> dist/styles.css
  eleventyConfig.addPassthroughCopy({ "styles.css": "styles.css" });

  // 2) Assets folder (images, logos, etc.)
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // 3) Optional root files
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });
  // eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });

  // 4) Legal footer helper (if you use it)
  eleventyConfig.addPassthroughCopy({ "src/legal-footer.js": "legal-footer.js" });

  // 5) Calculators: copy ONLY JS files (let Eleventy render the HTML pages)
  eleventyConfig.addPassthroughCopy({ "src/calculators/**/*.js": "calculators" });

  // Watch the root CSS so dev server hot-reloads styles
  eleventyConfig.addWatchTarget("styles.css");

  return {
    dir: {
      input: "src",
      output: "dist"
    }
  };
};

