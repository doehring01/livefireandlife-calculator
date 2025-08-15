module.exports = function(eleventyConfig) {
  // Copy all assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // Only passthrough the toggle JS file (the main script is built by Eleventy)
  eleventyConfig.addPassthroughCopy({ "src/calculators/take-home-pay-toggle.js": "calculators/take-home-pay-toggle.js" });

  return {
    dir: {
      input: "src",
      output: "dist" // Change to "_site" if that’s your actual output folder
    }
  };
};

