// .eleventy.js
module.exports = function(eleventyConfig) {
  // --- Static assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // --- Netlify headers passthrough (if using)
  eleventyConfig.addPassthroughCopy({ "src/_headers": "_headers" });

  // --- Copy standalone stylesheet at root of src
  eleventyConfig.addPassthroughCopy({ "src/styles.css": "styles.css" });

  // --- Jekyll compatibility shims (for relative_url, absolute_url)
  eleventyConfig.addFilter("relative_url", (value) => {
    if (!value) return value;
    return value.replace(/([^:]\/)\/+/g, "$1");
  });

  const SITE_URL = process.env.SITE_URL || "";
  eleventyConfig.addFilter("absolute_url", (value) => {
    if (!value) return value;
    const joined = (SITE_URL.replace(/\/+$/, "") + "/" + value.replace(/^\/+/, ""))
      .replace(/([^:]\/)\/+/g, "$1");
    return joined;
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      layouts: "_layouts",
      output: "dist"
    },
    htmlTemplateEngine: "liquid",
    markdownTemplateEngine: "liquid",
    dataTemplateEngine: false
  };
};
