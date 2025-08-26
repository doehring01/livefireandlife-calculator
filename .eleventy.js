// .eleventy.js
module.exports = function (eleventyConfig) {
  // --- Passthroughs ---

  // 1) Root CSS -> /styles.css
  eleventyConfig.addPassthroughCopy("styles.css");

  // 2) Assets (images, logos, etc.) -> /assets/**
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // 3) Optional root files
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });
  // eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });
  // eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" }); // if using a custom domain on GH Pages

  // 4) Legal footer helper (if used)
  eleventyConfig.addPassthroughCopy({ "src/legal-footer.js": "legal-footer.js" });

  // 5) Calculators: copy ONLY JS files (let Eleventy render HTML pages)
  // Use a glob string so Eleventy preserves subfolders (e.g. /calculators/coast-fi/coastfi.js)
  eleventyConfig.addPassthroughCopy("src/calculators/**/*.js");

  // Watch the root CSS so dev server hot-reloads styles
  eleventyConfig.addWatchTarget("styles.css");

  return {
    dir: {
      input: "src",
      output: "dist"
    }
  };
};