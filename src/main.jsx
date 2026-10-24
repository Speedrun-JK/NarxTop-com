const root = document.getElementById("root");

function showProblem(title, message) {
  if (!root) return;
  root.innerHTML = "";
  const box = document.createElement("div");
  box.setAttribute("role", "alert");
  box.style.cssText = "max-width:560px;margin:12vh auto;padding:24px;font:16px/1.5 system-ui,sans-serif;color:#2a1d14";
  const heading = document.createElement("h2");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = message;
  box.append(heading, paragraph);
  root.appendChild(box);
}

import("./bootstrap.jsx")
  .then((module) => module.default(root))
  .catch((error) => {
    console.error(error);
    showProblem("NarxTop could not start", "Reload the page. If it keeps happening, check the browser console.");
  });
