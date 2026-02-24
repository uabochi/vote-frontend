const API_URL = "https://vote-backend-oqtz.onrender.com";
// const API_URL = "http://localhost:5000";

const socket = io(API_URL);
let votingActive = false;

/* ===========================
   COLOR SYSTEM FOR CHARTS
=========================== */

const colorPalette = [
  "#1abc9c", // turquoise
  "#3498db", // blue
  "#9b59b6", // purple
  "#f1c40f", // yellow
  "#e74c3c", // red
  "#2ecc71", // green
  "#34495e", // dark blue-gray
  "#e67e22", // orange

  "#16a085", // darker turquoise
  "#2980b9", // darker blue
  "#8e44ad", // darker purple
  "#f39c12", // dark yellow-orange
  "#c0392b", // dark red
  "#27ae60", // dark green
  "#2c3e50", // navy
  "#d35400", // dark orange

  "#7f8c8d", // gray
  "#95a5a6", // light gray
  "#ff6b6b", // soft red
  "#6c5ce7", // violet
  "#00cec9", // aqua
  "#fd79a8", // pink
  "#55efc4", // mint
  "#ffeaa7", // pale yellow
];

let colorIndex = 0;
const candidateColors = {};
const charts = {}; // store chart instances

function getColorForCandidate(name) {
  if (!candidateColors[name]) {
    candidateColors[name] = colorPalette[colorIndex % colorPalette.length];
    colorIndex++;
  }
  return candidateColors[name];
}

/* LOGIN */
async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    document.getElementById("error").innerText = data.message;
    return;
  }

  localStorage.setItem("user", JSON.stringify(data));

  if (data.role === "admin") {
    window.location.href = "admin.html";
  } else {
    window.location.href = "home.html";
  }
}

/* LOGOUT */
function logout() {
  localStorage.removeItem("user");
  window.location.href = "index.html";
}

/* LOAD DASHBOARD */
if (window.location.pathname.includes("home.html")) {
  loadDashboard();
}

// Load dashboard and results
async function loadDashboard() {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return logout();

  document.getElementById("userDisplay").innerText = user.username;

  // Get voting status and candidates
  const statusRes = await fetch(`${API_URL}/voting-status`);
  const status = await statusRes.json();

  votingActive = status.votingActive;
  setVotingButtons(votingActive);
  updateTimerDisplay(status.countdown);

  const res = await fetch(`${API_URL}/candidates`);
  const candidates = await res.json();

  const container = document.getElementById("positions");
  container.innerHTML = "";

  for (let pos of candidates) {
    createPosition(pos.position, pos.candidates, user.username);
  }

  loadResults();
}

/* CREATE POSITION */
async function createPosition(position, candidates, username) {
  const div = document.createElement("div");
  div.className = "position-card";
  div.innerHTML = `<h3>${position}</h3>`;

  for (let candidate of candidates) {
    const btn = document.createElement("button");
    btn.classList.add("vote-btn");
    btn.innerText = candidate;
    btn.onclick = () => {
      if (!votingActive) {
        alert("Voting is not active");
        return;
      }
      vote(username, position, candidate);
    };
    // btn.onclick = () => vote(username, position, candidate);
    div.appendChild(btn);
  }

  const canvas = document.createElement("canvas");
  canvas.id = `chart-${position}`;
  div.appendChild(canvas);

  document.getElementById("positions").appendChild(div);
}

/* VOTE */
async function vote(username, position, candidate) {
  const res = await fetch(`${API_URL}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, position, candidate }),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.message);
    return;
  }

  // Immediately refresh results
  await loadResults();
}

/* LOAD RESULTS */
async function loadResults() {
  const res = await fetch(`${API_URL}/results`);
  const results = await res.json();

  for (let position in results) {
    const canvas = document.getElementById(`chart-${position}`);
    if (!canvas) continue;

    const labels = Object.keys(results[position]);
    const data = Object.values(results[position]);

    const backgroundColors = labels.map((label) => getColorForCandidate(label));

    if (charts[position]) {
      // Update existing chart
      charts[position].data.labels = labels;
      charts[position].data.datasets[0].data = data;
      charts[position].data.datasets[0].backgroundColor = backgroundColors;
      charts[position].update();
    } else {
      // Create new chart only once
      charts[position] = new Chart(canvas, {
        type: "pie",
        data: {
          labels: labels,
          datasets: [
            {
              data: data,
              backgroundColor: backgroundColors,
            },
          ],
        },
        options: {
          responsive: true,
          animation: {
            animateRotate: true,
          },
        },
      });
    }
  }
}

function updateCharts(results) {
  for (let position in results) {
    const ctx = document.getElementById(`chart-${position}`);
    if (!ctx) continue;

    if (charts[position]) {
      charts[position].data.labels = Object.keys(results[position]);
      charts[position].data.datasets[0].data = Object.values(results[position]);
      charts[position].update();
    } else {
      charts[position] = new Chart(ctx, {
        type: "pie",
        data: {
          labels: Object.keys(results[position]),
          datasets: [
            {
              data: Object.values(results[position]),
            },
          ],
        },
      });
    }
  }
}

// ENABLE/DISABLE VOTING BUTTONS
function setVotingButtons(state) {
  const buttons = document.querySelectorAll(".position-card button");
  buttons.forEach((btn) => {
    btn.disabled = !state;
    btn.style.opacity = state ? "1" : "0.5";
  });
}

// START VOTING (ADMIN)
async function startVoting() {
  await fetch(`${API_URL}/start-voting`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ duration: 259200 }), // 72 hours
  });
}

// STOP VOTING (ADMIN)
async function stopVoting() {
  await fetch(`${API_URL}/stop-voting`, {
    method: "POST",
  });
}

// UPDATE TIMER DISPLAY
socket.on("voting-status", (data) => {
  votingActive = data.votingActive;
  setVotingButtons(votingActive);
  updateTimerDisplay(data.countdown);
});

socket.on("timer-update", (data) => {
  updateTimerDisplay(data.countdown);
});

socket.on("voting-ended", () => {
  votingActive = false;
  setVotingButtons(false);
  updateTimerDisplay(0);
});

// UPDATE TIMER DISPLAY
function updateTimerDisplay(seconds) {
  const display = document.getElementById("timerDisplay");
  if (!display) return;

  if (!seconds || seconds <= 0) {
    display.innerText = "Voting Closed";
    return;
  }

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const formattedTime = `
    ${hrs.toString().padStart(2, "0")} :    ${mins.toString().padStart(2, "0")} :    ${secs.toString().padStart(2, "0")}  `;

  display.innerText = `Voting Ends In ${formattedTime}`;
}

/* ================= ADMIN ================= */

if (window.location.pathname.includes("admin.html")) {
  loadUsers();
  loadVotes();
}

/* USERS */
async function loadUsers() {
  const res = await fetch(`${API_URL}/users`);
  const users = await res.json();

  const list = document.getElementById("usersList");
  list.innerHTML = "";

  users.forEach((user) => {
    const div = document.createElement("div");
    div.innerHTML = `
            ${user.username} (${user.role})
            <button onclick="deleteUser('${user._id}')">Delete</button>
        `;
    list.appendChild(div);
  });
}

// Add new user (admin)
async function addUser() {
  const username = document.getElementById("newUsername").value.toUpperCase();
  const role = document.getElementById("role").value;

  const res = await fetch(`${API_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, role }),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.message);
    return;
  }

  // Show password in UI instead of alert
  const passwordBox = document.getElementById("passwordBox");

  if (passwordBox) {
    passwordBox.innerHTML = `
      <p><strong>Generated Password:</strong></p>
      <input id="generatedPassword" value="${data.generatedPassword}" readonly />
      <button onclick="copyPassword()">Copy</button>
    `;
  }

  loadUsers();
}

// Delete user (admin)
async function deleteUser(id) {
  await fetch(`${API_URL}/users/${id}`, { method: "DELETE" });
  loadUsers();
}

/* VOTES */
async function loadVotes() {
  const res = await fetch(`${API_URL}/results`);
  const results = await res.json();

  const votesList = document.getElementById("votesList");
  votesList.innerHTML = JSON.stringify(results, null, 2);
}

function copyPassword() {
  const input = document.getElementById("generatedPassword");
  input.select();
  document.execCommand("copy");
  alert("Password copied!");
}
