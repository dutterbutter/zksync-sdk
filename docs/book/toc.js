// Populate the sidebar
//
// This is a script, and not included directly in the page, to control the total size of the book.
// The TOC contains an entry for each page, so if each page includes a copy of the TOC,
// the total size of the page becomes O(n**2).
class MDBookSidebarScrollbox extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    this.innerHTML =
      '<ol class="chapter"><li class="chapter-item expanded "><a href="index.html"><strong aria-hidden="true">1.</strong> Overview</a></li><li class="chapter-item expanded "><a href="api/index.html"><strong aria-hidden="true">2.</strong> API Reference</a></li><li class="chapter-item expanded "><a href="api/ethers/src/index.html"><strong aria-hidden="true">3.</strong> Ethers SDK (@zksync-sdk/ethers)</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="api/ethers/src/functions/sendBundle.html"><strong aria-hidden="true">3.1.</strong> sendBundle</a></li><li class="chapter-item expanded "><a href="api/ethers/src/functions/sendERC20.html"><strong aria-hidden="true">3.2.</strong> sendERC20</a></li><li class="chapter-item expanded "><a href="api/ethers/src/functions/sendNative.html"><strong aria-hidden="true">3.3.</strong> sendNative</a></li><li class="chapter-item expanded "><a href="api/ethers/src/functions/remoteCall.html"><strong aria-hidden="true">3.4.</strong> remoteCall</a></li></ol></li><li class="chapter-item expanded "><a href="api/core/src/index.html"><strong aria-hidden="true">4.</strong> Core SDK (@zksync-sdk/core)</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="api/core/src/variables/ATTR.html"><strong aria-hidden="true">4.1.</strong> ATTR</a></li><li class="chapter-item expanded "><a href="api/core/src/variables/bundle.html"><strong aria-hidden="true">4.2.</strong> bundle</a></li><li class="chapter-item expanded "><a href="api/core/src/variables/defaultRegistry.html"><strong aria-hidden="true">4.3.</strong> defaultRegistry</a></li><li class="chapter-item expanded "><a href="api/core/src/functions/encodeEvmV1.html"><strong aria-hidden="true">4.4.</strong> encodeEvmV1</a></li><li class="chapter-item expanded "><a href="api/core/src/functions/encodeEvmV1AddressOnly.html"><strong aria-hidden="true">4.5.</strong> encodeEvmV1AddressOnly</a></li><li class="chapter-item expanded "><a href="api/core/src/functions/encodeEvmV1ChainOnly.html"><strong aria-hidden="true">4.6.</strong> encodeEvmV1ChainOnly</a></li><li class="chapter-item expanded "><a href="api/core/src/functions/toCallStarter.html"><strong aria-hidden="true">4.7.</strong> toCallStarter</a></li><li class="chapter-item expanded "><a href="api/core/src/interfaces/BundleInput.html"><strong aria-hidden="true">4.8.</strong> BundleInput</a></li><li class="chapter-item expanded "><a href="api/core/src/type-aliases/BundleItem.html"><strong aria-hidden="true">4.9.</strong> BundleItem</a></li><li class="chapter-item expanded "><a href="api/core/src/interfaces/NativeTransferInput.html"><strong aria-hidden="true">4.10.</strong> NativeTransferInput</a></li><li class="chapter-item expanded "><a href="api/core/src/interfaces/ERC20TransferInput.html"><strong aria-hidden="true">4.11.</strong> ERC20TransferInput</a></li><li class="chapter-item expanded "><a href="api/core/src/interfaces/RemoteCallInput.html"><strong aria-hidden="true">4.12.</strong> RemoteCallInput</a></li><li class="chapter-item expanded "><a href="api/core/src/interfaces/SentMessage.html"><strong aria-hidden="true">4.13.</strong> SentMessage</a></li><li class="chapter-item expanded "><a href="api/core/src/classes/InteropError.html"><strong aria-hidden="true">4.14.</strong> InteropError</a></li><li class="chapter-item expanded "><a href="api/core/src/functions/parseSendIdFromLogs.html"><strong aria-hidden="true">4.15.</strong> parseSendIdFromLogs</a></li><li class="chapter-item expanded "><a href="api/core/src/functions/parseBundleHashFromLogs.html"><strong aria-hidden="true">4.16.</strong> parseBundleHashFromLogs</a></li><li class="chapter-item expanded "><a href="api/core/src/functions/computeBundleMessageValue.html"><strong aria-hidden="true">4.17.</strong> computeBundleMessageValue</a></li></ol></li></ol>';
    // Set the current, active page, and reveal it if it's hidden
    let current_page = document.location.href.toString().split('#')[0].split('?')[0];
    if (current_page.endsWith('/')) {
      current_page += 'index.html';
    }
    var links = Array.prototype.slice.call(this.querySelectorAll('a'));
    var l = links.length;
    for (var i = 0; i < l; ++i) {
      var link = links[i];
      var href = link.getAttribute('href');
      if (href && !href.startsWith('#') && !/^(?:[a-z+]+:)?\/\//.test(href)) {
        link.href = path_to_root + href;
      }
      // The "index" page is supposed to alias the first chapter in the book.
      if (
        link.href === current_page ||
        (i === 0 && path_to_root === '' && current_page.endsWith('/index.html'))
      ) {
        link.classList.add('active');
        var parent = link.parentElement;
        if (parent && parent.classList.contains('chapter-item')) {
          parent.classList.add('expanded');
        }
        while (parent) {
          if (parent.tagName === 'LI' && parent.previousElementSibling) {
            if (parent.previousElementSibling.classList.contains('chapter-item')) {
              parent.previousElementSibling.classList.add('expanded');
            }
          }
          parent = parent.parentElement;
        }
      }
    }
    // Track and set sidebar scroll position
    this.addEventListener(
      'click',
      function (e) {
        if (e.target.tagName === 'A') {
          sessionStorage.setItem('sidebar-scroll', this.scrollTop);
        }
      },
      { passive: true },
    );
    var sidebarScrollTop = sessionStorage.getItem('sidebar-scroll');
    sessionStorage.removeItem('sidebar-scroll');
    if (sidebarScrollTop) {
      // preserve sidebar scroll position when navigating via links within sidebar
      this.scrollTop = sidebarScrollTop;
    } else {
      // scroll sidebar to current active section when navigating via "next/previous chapter" buttons
      var activeSection = document.querySelector('#sidebar .active');
      if (activeSection) {
        activeSection.scrollIntoView({ block: 'center' });
      }
    }
    // Toggle buttons
    var sidebarAnchorToggles = document.querySelectorAll('#sidebar a.toggle');
    function toggleSection(ev) {
      ev.currentTarget.parentElement.classList.toggle('expanded');
    }
    Array.from(sidebarAnchorToggles).forEach(function (el) {
      el.addEventListener('click', toggleSection);
    });
  }
}
window.customElements.define('mdbook-sidebar-scrollbox', MDBookSidebarScrollbox);
