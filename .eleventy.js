module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  return {
    dir: { input: "src", includes: "_includes", layouts: "_layouts", output: "dist" }
  };
};
