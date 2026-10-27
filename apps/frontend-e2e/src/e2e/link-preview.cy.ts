/**
 * Link previews (LinkedIn, Slack, ...): crawlers don't run JavaScript, so the Open Graph tags must
 * be in the index.html itself. nginx replaces __SITE_ORIGIN__ with the site's address (tested in
 * apps/frontend/nginx/test-real-ip.sh), because LinkedIn needs an absolute image URL.
 */
describe('link preview', () => {
  const meta = (html: string, attr: 'property' | 'name', key: string) =>
    new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(`meta[${attr}="${key}"]`)
      ?.getAttribute('content');

  it('has Open Graph and Twitter tags in the served HTML', () => {
    cy.request('/').then(({ body }) => {
      expect(meta(body, 'property', 'og:type')).to.equal('website');
      expect(meta(body, 'property', 'og:title')).to.match(/Pierre/);
      expect(meta(body, 'property', 'og:description')).to.have.length.greaterThan(20);
      expect(meta(body, 'property', 'og:url')).to.equal('__SITE_ORIGIN__/');
      expect(meta(body, 'property', 'og:image')).to.equal('__SITE_ORIGIN__/og-image.png');
      expect(meta(body, 'property', 'og:image:width')).to.equal('1200');
      expect(meta(body, 'property', 'og:image:height')).to.equal('627');
      expect(meta(body, 'property', 'og:image:alt')).to.have.length.greaterThan(10);
      expect(meta(body, 'name', 'twitter:card')).to.equal('summary_large_image');
    });
  });

  it('serves the preview image', () => {
    cy.request({ url: '/og-image.png', encoding: 'binary' }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.headers['content-type']).to.match(/^image\/png/);
    });
  });
});
