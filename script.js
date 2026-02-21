const API_URL = "https://vote-backend-sx1r.onrender.com";

/* LOGIN */
async function login() {
    const username = document.getElementById("username").value;

    const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
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
    window.location.href = "login.html";
}

/* LOAD DASHBOARD */
if (window.location.pathname.includes("home.html")) {
    loadDashboard();
}

async function loadDashboard() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return logout();

    document.getElementById("userDisplay").innerText = user.username;

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
        btn.innerText = candidate;
        btn.onclick = () => vote(username, position, candidate);
        div.appendChild(btn);
    }

    const canvas = document.createElement("canvas");
    canvas.id = `chart-${position}`;
    div.appendChild(canvas);

    document.getElementById("positions").appendChild(div);
}

/* VOTE */
async function vote(username, position, candidate) {
    await fetch(`${API_URL}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, position, candidate })
    });

    loadResults();
}

/* LOAD RESULTS */
async function loadResults() {
    const res = await fetch(`${API_URL}/results`);
    const results = await res.json();

    for (let position in results) {
        const ctx = document.getElementById(`chart-${position}`);
        if (!ctx) continue;

        new Chart(ctx, {
            type: "pie",
            data: {
                labels: Object.keys(results[position]),
                datasets: [{
                    data: Object.values(results[position])
                }]
            }
        });
    }
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

    users.forEach(user => {
        const div = document.createElement("div");
        div.innerHTML = `
            ${user.username} (${user.role})
            <button onclick="deleteUser('${user._id}')">Delete</button>
        `;
        list.appendChild(div);
    });
}

async function addUser() {
    const username = document.getElementById("newUsername").value;
    const role = document.getElementById("role").value;

    await fetch(`${API_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, role })
    });

    loadUsers();
}

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