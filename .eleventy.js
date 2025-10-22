// .eleventy.js
module.exports = function(eleventyConfig) {
  // Copy assets (incl. your JSON) to /assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      layouts: "_layouts",
      output: "dist"
    },

    // Use Liquid for .html and .md (matches your existing site)
    htmlTemplateEngine: "liquid",
    markdownTemplateEngine: "liquid",

    // Data files can be plain JSON; no need for a template engine
    dataTemplateEngine: false
  };
};
