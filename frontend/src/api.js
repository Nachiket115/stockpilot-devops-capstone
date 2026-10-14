/**
 * StockPilot API Client
 * Wraps backend REST endpoints and normalizes error messages (409, 422, 503, network failure).
 */

export class ApiError extends Error {
  constructor(message, status = 0, detail = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function request(endpoint, options = {}) {
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  let response;
  try {
    response = await fetch(endpoint, config);
  } catch (err) {
    throw new ApiError(
      "Backend unreachable. Please verify that the API server is running on port 8000.",
      0,
      err.message
    );
  }

  if (response.status === 204) {
    return null;
  }

  let data = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    if (data && data.detail) {
      if (typeof data.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data.detail)) {
        message = data.detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
      }
    }
    throw new ApiError(message, response.status, data?.detail);
  }

  return data;
}

export const api = {
  async getItems(statusFilter = "") {
    const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
    return request(`/api/items${query}`);
  },

  async getStats() {
    return request("/api/items/stats");
  },

  async getItem(id) {
    return request(`/api/items/${id}`);
  },

  async createItem(item) {
    return request("/api/items", {
      method: "POST",
      body: JSON.stringify(item),
    });
  },

  async updateItem(id, item) {
    return request(`/api/items/${id}`, {
      method: "PUT",
      body: JSON.stringify(item),
    });
  },

  async deleteItem(id) {
    return request(`/api/items/${id}`, {
      method: "DELETE",
    });
  },

  async issueItem(id, quantity) {
    return request(`/api/items/${id}/issue`, {
      method: "POST",
      body: JSON.stringify({ quantity }),
    });
  },
};
