module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  return {
    dir: { input: "src", output: "dist" } // change "dist" to "_site" if that's your actual output folder
  };
};

