const menuButton = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("[data-nav]");

if (menuButton && nav) {
  menuButton.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
}
