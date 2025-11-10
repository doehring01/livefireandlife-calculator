// .eleventy.js
module.exports = function(eleventyConfig) {
  /* ---------------------------
     Passthrough copies
  ---------------------------- */
  // Copies everything under src/assets (incl. css + data) to /assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  // Calculator JS (outside assets)
  eleventyConfig.addPassthroughCopy({
    "src/calculators/contribution-optimizer/app.js":
      "calculators/contribution-optimizer/app.js"
  });
  // Optional Netlify _headers file if present
  eleventyConfig.addPassthroughCopy({ "src/_headers": "_headers" });
  // Optional root stylesheet
  eleventyConfig.addPassthroughCopy({ "src/styles.css": "styles.css" });

  // Helpful during dev: watch these so the server reloads
  eleventyConfig.addWatchTarget("src/assets");
  eleventyConfig.addWatchTarget("src/calculators/contribution-optimizer/app.js");

  /* ---------------------------
     Jekyll compatibility filters
  ---------------------------- */
  eleventyConfig.addFilter("relative_url", (value) => {
    if (!value) return value;
    // collapse accidental double slashes but keep protocol slashes
    return String(value).replace(/([^:]\/)\/+/g, "$1");
  });

  const SITE_URL = process.env.SITE_URL || ""; // e.g. https://livefireandlife.com
  eleventyConfig.addFilter("absolute_url", (value) => {
    if (!value) return value;
    const joined = (SITE_URL.replace(/\/+$/, "") + "/" + String(value).replace(/^\/+/, ""))
      .replace(/([^:]\/)\/+/g, "$1");
    return joined;
  });

  /* ---------------------------
     Collections
  ---------------------------- */
  eleventyConfig.addCollection("livePosts", (collectionApi) => {
    // Approximate Mountain Time "start of today"
    const now = new Date();
    const msPerHour = 3600 * 1000;
    const mtOffsetGuess = 7; // simple guard against clearly future-dated posts
    const mtNow = new Date(now.getTime() - mtOffsetGuess * msPerHour);
    const mtTodayStart = new Date(mtNow.getFullYear(), mtNow.getMonth(), mtNow.getDate());

    return collectionApi
      .getFilteredByGlob([
        "src/blog/*.{md,html,liquid,njk}",
        "src/blog/**/index.{md,html,liquid,njk}"
      ])
      .filter(item => item.url !== "/blog/")               // exclude landing page
      .filter(item => !item.data.draft)                    // honor draft: true
      .filter(item => {                                    // skip clearly future-dated
        const pub = item.data.date || item.date;
        return !pub || (pub <= mtTodayStart);
      })
      .sort((a, b) => {
        const ad = (a.data.date || a.date) ? new Date(a.data.date || a.date).getTime() : 0;
        const bd = (b.data.date || b.date) ? new Date(b.data.date || b.date).getTime() : 0;
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
      output: "dist" // change to "_site" if that's your deploy target
    },
    htmlTemplateEngine: "liquid",
    markdownTemplateEngine: "liquid",
    dataTemplateEngine: false
  };
};
