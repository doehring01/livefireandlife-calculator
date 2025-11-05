// .eleventy.js
module.exports = function(eleventyConfig) {
  /* ---------------------------
     Passthrough copies
  ---------------------------- */
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/_headers": "_headers" });   // if present
  eleventyConfig.addPassthroughCopy({ "src/styles.css": "styles.css" });

  /* ---------------------------
     Jekyll compatibility filters
  ---------------------------- */
  eleventyConfig.addFilter("relative_url", (value) => {
    if (!value) return value;
    // collapse accidental double slashes but keep protocol slashes
    return value.replace(/([^:]\/)\/+/g, "$1");
  });

  const SITE_URL = process.env.SITE_URL || ""; // e.g. https://livefireandlife.com
  eleventyConfig.addFilter("absolute_url", (value) => {
    if (!value) return value;
    const joined = (SITE_URL.replace(/\/+$/, "") + "/" + String(value).replace(/^\/+/, ""))
      .replace(/([^:]\/)\/+/g, "$1");
    return joined;
  });

  // --- Collection: all blog posts (exclude landing page, drafts; hide future-dated only)
eleventyConfig.addCollection("livePosts", (collectionApi) => {
  const now = new Date();

  return collectionApi
    .getFilteredByGlob([
      "src/blog/*.{md,html,liquid,njk}",
      "src/blog/**/index.{md,html,liquid,njk}"
    ])
    // exclude landing page
    .filter(item => item.url !== "/blog/")
    // honor drafts
    .filter(item => !item.data.draft)
    // hide future-dated posts only; if no date, keep it
    .filter(item => !(item.date && item.date > now))
    // newest first (fallback if date missing)
    .sort((a, b) => {
      const ad = a.date ? a.date.getTime() : 0;
      const bd = b.date ? b.date.getTime() : 0;
      return bd - ad;
    });
});

  /* ---------------------------
     Dir & templating engines
  ---------------------------- */
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