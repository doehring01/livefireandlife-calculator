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
  // Blog posts: include both "single files" and "folder/index" posts,
  // exclude the landing page (/blog/), honor draft, and skip truly future-dated posts.
  // We compare against "today at 00:00 UTC-07:00" (America/Denver-ish) to avoid
  // timezone surprises around midnight deploys.
  eleventyConfig.addCollection("livePosts", (collectionApi) => {
    // Define "today start" in Mountain Time (UTC-07 standard / UTC-06 DST).
    // Netlify builds in UTC; we normalize by subtracting 7h then zeroing the date.
    const now = new Date();
    const msPerHour = 3600 * 1000;
    const mtOffsetGuess = 7; // simple, good enough for hiding only clearly future-dated posts
    const mtNow = new Date(now.getTime() - mtOffsetGuess * msPerHour);
    const mtTodayStart = new Date(mtNow.getFullYear(), mtNow.getMonth(), mtNow.getDate()); // 00:00 MT (approx)

    return collectionApi
      .getFilteredByGlob([
        "src/blog/*.{md,html,liquid,njk}",
        "src/blog/**/index.{md,html,liquid,njk}"
      ])
      // exclude the landing page itself
      .filter(item => item.url !== "/blog/")
      // honor front matter draft: true
      .filter(item => !item.data.draft)
      // pick a publish date (prefer explicit front matter date)
      .filter(item => {
        const pub = item.data.date || item.date;
        // keep if no date (lenient), or if <= start of "today" in MT
        return !pub || (pub <= mtTodayStart);
      })
      // newest first (fallback to 0 if no date)
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
      output: "dist"
    },
    htmlTemplateEngine: "liquid",
    markdownTemplateEngine: "liquid",
    dataTemplateEngine: false
  };
};