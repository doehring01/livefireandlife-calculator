// .eleventy.js
module.exports = function(eleventyConfig) {

  // ✅ Copy everything inside src/assets → /assets in the built site
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // ✅ Optional: you can add more passthroughs later
  // eleventyConfig.addPassthroughCopy({ "src/static": "static" });

  // ✅ Main configuration
  return {
    dir: {
      input: "src",           // where your site source files live
      includes: "_includes",  // partials, components, etc.
      layouts: "_layouts",    // base layouts
      output: "dist"          // build output directory
    },

    // ✅ Force Eleventy to treat .html, .md, and data files as Nunjucks
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    dataTemplateEngine: "njk"
  };
};
