function frameLayout(width, height, rowTops) {
  return {
    width,
    height,
    ego: { left: 930 / width, width: 720 / width },
    rowTop: rowTops.map((y) => y / height),
    rowHeight: 85 / height,
  };
}

const EXAMPLES = [
  {
    id: "example-1",
    title: "Example 1",
    heading: "Lettuce from the fridge",
    scene:
      "Open the fridge, open a drawer, take out the lettuce, open the package, close the fridge, and open the package.",
    video: "media/example1.mp4",
    layout: frameLayout(1700, 886, [248, 333, 418, 503, 588]),
    marks: [
      { time: 8, action: "open fridge", ego: { rank: 1 } },
      { time: 15, action: "open drawer", ego: { rank: 1 } },
      { time: 25, action: "open package", ego: { rank: 4 } },
      { time: 46, action: "close fridge", ego: { rank: 3 } },
      { time: 55, action: "open package", ego: { rank: 4 } },
    ],
  },
  {
    id: "example-2",
    title: "Example 2",
    heading: "Washing at the sink",
    scene:
      "Turn on the tap, pour water, wash, wash a plate, turn off the tap, and take the plate.",
    video: "media/example2.mp4",
    layout: frameLayout(1700, 864, [234, 319, 404, 489, 574]),
    marks: [
      { time: 8, action: "turn-on tap", ego: { rank: 3 } },
      { time: 23, action: "pour water", ego: { rank: 4 } },
      { time: 30, action: "take liquid:washing", ego: { rank: 1 } },
      { time: 39, action: "wash plate", ego: { rank: 1 } },
      { time: 43, action: "turn-off tap", ego: { rank: 2 } },
      { time: 51, action: "take plate", ego: { rank: 4 } },
    ],
  },
  {
    id: "example-3",
    title: "Example 3",
    heading: "Cup in the microwave",
    scene:
      "Take a cup, turn on the tap, turn off the tap, open the microwave, insert the cup, and turn on the microwave.",
    video: "media/example3.mp4",
    layout: frameLayout(1734, 864, [234, 319, 404, 489, 574]),
    marks: [
      { time: 3, action: "take cup", ego: { rank: 5 } },
      { time: 15, action: "turn-on tap", ego: { rank: 1 } },
      { time: 21, action: "turn-off tap", ego: { rank: 2 } },
      { time: 35, action: "open microwave", ego: { rank: 3 } },
      { time: 39, action: "insert cup", ego: { rank: 1 } },
      { time: 47, action: "turn-on microwave", ego: { rank: 1 } },
    ],
  },
];

const nav = document.querySelector("#example-nav");
const main = document.querySelector("#main");

let currentId = EXAMPLES[0].id;
let pinned = null;
let video = null;

function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function rankLabel(hit) {
  if (!hit) return "not in top 5";
  return hit.rank === 1 ? "rank 1" : `rank ${hit.rank}`;
}

function renderNav() {
  nav.innerHTML = "";
  for (const example of EXAMPLES) {
    const button = document.createElement("button");
    button.className = "example-tab";
    button.type = "button";
    if (example.id === currentId) button.setAttribute("aria-current", "true");
    button.textContent = example.title;
    if (example.pending) {
      const soon = document.createElement("span");
      soon.className = "soon";
      soon.textContent = "next";
      button.appendChild(soon);
    }
    button.addEventListener("click", () => {
      currentId = example.id;
      pinned = null;
      render();
    });
    nav.appendChild(button);
  }
}

function activeExample() {
  return EXAMPLES.find((example) => example.id === currentId);
}

function renderPending(example) {
  main.innerHTML = "";
  const empty = document.createElement("section");
  empty.className = "empty";
  empty.innerHTML = `<div><h2>${example.title}</h2><p>This clip will be added as the next example.</p></div>`;
  main.appendChild(empty);
}

function renderPlayer(example) {
  main.innerHTML = "";
  const section = document.createElement("section");
  section.className = "scene";
  section.innerHTML = `
    <h2>${example.heading}</h2>
    <p>${example.scene}</p>
    <div class="stage-scroll">
        <div class="stage" style="aspect-ratio: ${example.layout.width} / ${example.layout.height}">
        <video id="player" src="${example.video}" preload="auto" playsinline></video>
        <div class="overlay" id="overlay"></div>
      </div>
    </div>
    <div class="caption">
      <strong id="caption-title">Play the clip</strong>
      <span id="caption-detail">Rings appear at each checkpoint. Select a time to hold the frame.</span>
    </div>
    <div class="controls">
      <button class="play" id="play" type="button" aria-label="Play">Play</button>
      <div class="scrub">
        <input id="seek" type="range" min="0" max="1000" value="0" aria-label="Seek">
        <div class="markers" id="markers"></div>
      </div>
      <div class="time" id="time">0:00 / 1:04</div>
    </div>
    <div class="legend">
      <span><i class="swatch ego"></i>EgoNext</span>
    </div>
    <div class="moments">
      <h3>Checkpoints</h3>
      <div id="moment-list"></div>
    </div>
  `;
  main.appendChild(section);

  video = section.querySelector("#player");
  const overlay = section.querySelector("#overlay");
  const play = section.querySelector("#play");
  const seek = section.querySelector("#seek");
  const time = section.querySelector("#time");
  const markers = section.querySelector("#markers");
  const momentList = section.querySelector("#moment-list");
  const captionTitle = section.querySelector("#caption-title");
  const captionDetail = section.querySelector("#caption-detail");

  example.marks.forEach((mark, index) => {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "marker";
    marker.style.left = `${(mark.time / 64) * 100}%`;
    marker.title = `${formatTime(mark.time)} ${mark.action}`;
    marker.setAttribute("aria-label", `${formatTime(mark.time)} ${mark.action}`);
    marker.addEventListener("click", () => hold(mark));
    markers.appendChild(marker);

    const row = document.createElement("button");
    row.type = "button";
    row.className = "moment";
    row.dataset.index = String(index);
    row.innerHTML = `
      <span class="when">${formatTime(mark.time)}</span>
      <span class="action">${mark.action}</span>
      <span class="model ${mark.ego ? "hit" : "miss"}">EgoNext · ${rankLabel(mark.ego)}</span>
    `;
    row.addEventListener("click", () => hold(mark));
    momentList.appendChild(row);
  });

  function placeRing(modelKey, rank, label) {
    const layout = example.layout;
    const geom = layout[modelKey];
    const ring = document.createElement("div");
    ring.className = `ring ${modelKey}`;
    const padX = 8 / layout.width;
    const padY = 5 / layout.height;
    ring.style.left = `${(geom.left - padX) * 100}%`;
    ring.style.width = `${(geom.width + padX * 2) * 100}%`;
    ring.style.top = `${(layout.rowTop[rank - 1] - padY) * 100}%`;
    ring.style.height = `${(layout.rowHeight + padY * 2) * 100}%`;
    const tag = document.createElement("span");
    tag.className = "ring-tag";
    tag.textContent = label;
    ring.appendChild(tag);
    overlay.appendChild(ring);
  }

  function visibleMark() {
    if (!video) return null;
    if (pinned && video.paused) return pinned;
    const t = video.currentTime;
    let best = null;
    let bestDist = Infinity;
    for (const mark of example.marks) {
      if (t >= mark.time - 0.4 && t <= mark.time + 1.7) {
        const dist = Math.abs(t - mark.time);
        if (dist < bestDist) {
          best = mark;
          bestDist = dist;
        }
      }
    }
    return best;
  }

  function paint() {
    const mark = visibleMark();
    overlay.innerHTML = "";
    section.querySelectorAll(".moment").forEach((row) => {
      row.classList.toggle("active", mark && example.marks[Number(row.dataset.index)] === mark);
    });
    section.querySelectorAll(".marker").forEach((marker, index) => {
      marker.classList.toggle("active", mark && example.marks[index] === mark);
    });
    if (!mark) {
      captionTitle.textContent = video.paused ? "Paused" : "Playing";
      captionDetail.textContent = "Rings appear at each checkpoint.";
      return;
    }
    if (mark.ego) placeRing("ego", mark.ego.rank, "EgoNext");
    captionTitle.textContent = `${formatTime(mark.time)}  ${mark.action}`;
    captionDetail.textContent = mark.ego ? `EgoNext rank ${mark.ego.rank}` : "EgoNext missed";
  }

  function syncChrome() {
    const duration = Number.isFinite(video.duration) ? video.duration : 63.87;
    play.textContent = video.paused ? "Play" : "Pause";
    play.setAttribute("aria-label", video.paused ? "Play" : "Pause");
    if (!seek.matches(":active")) {
      seek.value = String(Math.round((video.currentTime / duration) * 1000));
    }
    time.textContent = `${formatTime(video.currentTime)} / ${formatTime(duration)}`;
    markers.querySelectorAll(".marker").forEach((marker, index) => {
      marker.style.left = `${(example.marks[index].time / duration) * 100}%`;
    });
    paint();
  }

  function hold(mark) {
    pinned = mark;
    video.pause();
    const apply = () => {
      video.currentTime = mark.time;
      syncChrome();
    };
    const ready =
      video.readyState >= 1 &&
      video.seekable.length > 0 &&
      video.seekable.end(video.seekable.length - 1) >= mark.time;
    if (ready) apply();
    else {
      video.addEventListener("loadeddata", apply, { once: true });
      syncChrome();
    }
  }

  play.addEventListener("click", () => {
    if (video.paused) {
      pinned = null;
      video.play();
    } else {
      video.pause();
    }
  });

  video.addEventListener("click", () => {
    if (video.paused) {
      pinned = null;
      video.play();
    } else {
      video.pause();
    }
  });

  video.addEventListener("play", () => {
    pinned = null;
    syncChrome();
  });
  video.addEventListener("pause", syncChrome);
  video.addEventListener("timeupdate", syncChrome);
  video.addEventListener("seeked", syncChrome);
  video.addEventListener("loadedmetadata", syncChrome);

  seek.addEventListener("input", () => {
    const duration = Number.isFinite(video.duration) ? video.duration : 63.87;
    pinned = null;
    video.currentTime = (Number(seek.value) / 1000) * duration;
  });
}

function render() {
  renderNav();
  const example = activeExample();
  if (example.pending) renderPending(example);
  else renderPlayer(example);
}

render();
