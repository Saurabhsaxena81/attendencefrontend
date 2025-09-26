// app.js - vanilla JS frontend for attendance
const API = "https://adriot-attendce-backend.vercel.app/attendance"; // backend endpoint

const statusEl = document.getElementById("status");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const employeeFilter = document.getElementById("employeeFilter");
const searchInput = document.getElementById("searchInput");
const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");
const refreshBtn = document.getElementById("refreshBtn");
const downloadBtn = document.getElementById("downloadBtn");

let rawData = []; // full JSON from backend
let columns = [];

// helpers
function showStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "var(--danger)" : "";
}

function formatBadge(status) {
  if (!status) return "";
  const s = String(status).toLowerCase();
  if (s.includes("present"))
    return `<span class="badge present">Present</span>`;
  if (s.includes("half")) return `<span class="badge half">Half Day</span>`;
  if (s.includes("week")) return `<span class="badge weekoff">Week Off</span>`;
  if (s.includes("missing") || s === "")
    return `<span class="badge missing">Missing</span>`;
  return `<span class="badge weekoff">${status}</span>`;
}

function renderTable(data) {
  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  if (!data || data.length === 0) {
    tableHead.innerHTML = "<tr><th>No data</th></tr>";
    return;
  }

  columns = Object.keys(data[0]);

  // header
  const headerRow = document.createElement("tr");
  columns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col;
    headerRow.appendChild(th);
  });
  tableHead.appendChild(headerRow);

  // body
  data.forEach((row) => {
    const tr = document.createElement("tr");
    columns.forEach((col) => {
      const td = document.createElement("td");
      const val = row[col] ?? "";
      // if this column is "Status" or similar, display badge
      if (String(col).toLowerCase().includes("status")) {
        td.innerHTML = formatBadge(val);
      } else {
        td.textContent = val;
      }
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });
}

function populateEmployeeFilter(data) {
  const ids = new Set();
  data.forEach((r) => {
    if (r.EmployeeID) ids.add(r.EmployeeID);
    if (r.EmployeeId) ids.add(r.EmployeeId); // some sheets use different names
    if (r.employeeId) ids.add(r.employeeId);
  });
  // clear
  employeeFilter.innerHTML = '<option value="">All Employees</option>';
  Array.from(ids)
    .sort()
    .forEach((id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id;
      employeeFilter.appendChild(opt);
    });
}

function applyFilters() {
  let filtered = rawData.slice();

  const search = searchInput.value.trim().toLowerCase();
  if (search) {
    filtered = filtered.filter((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(search))
    );
  }

  const emp = employeeFilter.value;
  if (emp) {
    filtered = filtered.filter((r) => {
      return (
        String(
          r.EmployeeID || r.EmployeeId || r.employeeId || ""
        ).toLowerCase() === emp.toLowerCase()
      );
    });
  }

  const from = fromDate.value;
  const to = toDate.value;
  if (from) {
    filtered = filtered.filter((r) => {
      const d = r.Date || r.date;
      if (!d) return false;
      return new Date(d) >= new Date(from);
    });
  }
  if (to) {
    filtered = filtered.filter((r) => {
      const d = r.Date || r.date;
      if (!d) return false;
      return new Date(d) <= new Date(to);
    });
  }

  renderTable(filtered);
}

async function fetchAttendance() {
  showStatus("Loading attendance...");
  try {
    const res = await fetch(API, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    if (!Array.isArray(data)) {
      showStatus("Backend returned unexpected format", true);
      console.error("Expected array, got:", data);
      return;
    }
    rawData = data;
    populateEmployeeFilter(rawData);
    applyFilters();
    showStatus(`Loaded ${rawData.length} records`);
  } catch (err) {
    console.error(err);
    showStatus("Failed to load attendance. See console.", true);
  }
}

// CSV download
function downloadCSV() {
  if (!rawData || rawData.length === 0) {
    alert("No data to download");
    return;
  }
  // Build CSV from currently applied filters
  let filteredRows = [];
  // Use applyFilters logic but returning rows
  const search = searchInput.value.trim().toLowerCase();
  const emp = employeeFilter.value;
  const from = fromDate.value;
  const to = toDate.value;

  filteredRows = rawData.filter((r) => {
    let ok = true;
    if (search) {
      ok = Object.values(r).some((v) =>
        String(v).toLowerCase().includes(search)
      );
    }
    if (ok && emp) {
      ok =
        String(
          r.EmployeeID || r.EmployeeId || r.employeeId || ""
        ).toLowerCase() === emp.toLowerCase();
    }
    if (ok && from) {
      const d = r.Date || r.date;
      ok = d ? new Date(d) >= new Date(from) : false;
    }
    if (ok && to) {
      const d = r.Date || r.date;
      ok = d ? new Date(d) <= new Date(to) : false;
    }
    return ok;
  });

  const cols = Object.keys(filteredRows[0] || {});
  const csvRows = [cols.join(",")];
  filteredRows.forEach((r) => {
    const row = cols
      .map((c) => {
        const v = r[c] ?? "";
        // escape quotes
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      })
      .join(",");
    csvRows.push(row);
  });

  const csvContent = csvRows.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// events
searchInput.addEventListener("input", () => applyFilters());
employeeFilter.addEventListener("change", () => applyFilters());
fromDate.addEventListener("change", () => applyFilters());
toDate.addEventListener("change", () => applyFilters());
refreshBtn.addEventListener("click", () => fetchAttendance());
downloadBtn.addEventListener("click", () => downloadCSV());

// initial load
fetchAttendance();
