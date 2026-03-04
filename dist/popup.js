import"./assets/modulepreload-polyfill-B5Qt9EMX.js";function n(e){const t=document.getElementById("status");t&&(t.textContent=e)}function a(e){const t=document.getElementById("result");t&&(t.innerHTML=`
    <div>Score: ${e.score}</div>
    <div>Summary: ${e.summary}</div>
    <div>Top gaps:<ul>${e.gaps.slice(0,3).map(i=>`<li>${i}</li>`).join("")}</ul></div>
  `)}async function o(){n("Analyzing...");const[e]=await chrome.tabs.query({active:!0,currentWindow:!0});if(!e.id)return n("No active tab");const t=await chrome.runtime.sendMessage({type:"SCRAPE_AND_ANALYZE",tabId:e.id});if(!(t!=null&&t.ok)){n(`Error: ${(t==null?void 0:t.error)||"unknown"}`);return}a(t.analysis),n("Done")}async function r(){await chrome.runtime.sendMessage({type:"OPEN_EDITOR"})}document.addEventListener("DOMContentLoaded",()=>{const e=document.getElementById("analyze-btn"),t=document.getElementById("edit-btn");e==null||e.addEventListener("click",o),t==null||t.addEventListener("click",r)});
