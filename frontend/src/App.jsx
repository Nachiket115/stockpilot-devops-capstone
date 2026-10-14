import React, { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "./api";
import { StatsStrip } from "./components/StatsStrip";
import { FilterBar } from "./components/FilterBar";
import { ItemTable } from "./components/ItemTable";
import { CreateItemModal } from "./components/CreateItemModal";
import { DeleteModal } from "./components/DeleteModal";
import { ErrorBanner } from "./components/ErrorBanner";

export default function App() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, in_stock: 0, low: 0, out_of_stock: 0 });
  const [activeFilter, setActiveFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [globalError, setGlobalError] = useState(null);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createApiError, setCreateApiError] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);
  const [deleteApiError, setDeleteApiError] = useState("");

  // Fetch items based on active status filter
  const fetchItems = useCallback(async (statusFilter) => {
    try {
      const data = await api.getItems(statusFilter);
      setItems(data || []);
      return data;
    } catch (err) {
      setGlobalError(err);
      throw err;
    }
  }, []);

  // Fetch stats strip
  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      if (data) {
        setStats(data);
      }
      return data;
    } catch (err) {
      // Don't overwrite global error if it's already set
      setGlobalError((prev) => prev || err);
    }
  }, []);

  // Initial load or on filter change
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setGlobalError(null);

    try {
      await Promise.all([fetchItems(activeFilter), fetchStats()]);
    } catch {
      // Errors handled inside fetchItems/fetchStats
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter, fetchItems, fetchStats]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Handle status filter change
  function handleFilterChange(newFilter) {
    setActiveFilter(newFilter);
  }

  // Handle item creation
  async function handleCreateSubmit(payload) {
    setSubmittingCreate(true);
    setCreateApiError("");
    try {
      await api.createItem(payload);
      setCreateModalOpen(false);
      // Refresh items and stats strip immediately
      await Promise.all([fetchItems(activeFilter), fetchStats()]);
    } catch (err) {
      if (err.status === 409) {
        setCreateApiError(err.message || "An item with this SKU already exists in inventory.");
      } else {
        setCreateApiError(err.message || "Failed to create item.");
      }
    } finally {
      setSubmittingCreate(false);
    }
  }

  // Handle issue stock action from a table row
  async function handleIssueSuccess(itemId, quantity) {
    const updated = await api.issueItem(itemId, quantity);
    // Refetch items under current filter and refresh stats strip
    await Promise.all([fetchItems(activeFilter), fetchStats()]);
    return updated;
  }

  // Handle delete item
  function openDeleteDialog(item) {
    setItemToDelete(item);
    setDeleteApiError("");
    setDeleteModalOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!itemToDelete) return;
    setSubmittingDelete(true);
    setDeleteApiError("");
    try {
      await api.deleteItem(itemToDelete.id);
      setDeleteModalOpen(false);
      setItemToDelete(null);
      // Refresh items and stats strip immediately
      await Promise.all([fetchItems(activeFilter), fetchStats()]);
    } catch (err) {
      setDeleteApiError(err.message || "Failed to delete item.");
    } finally {
      setSubmittingDelete(false);
    }
  }

  // Filter items in memory by search query (SKU or name)
  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.sku.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q)
    );
  });

  return (
    <div className="app-layout">
      {/* Top Industrial Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="header-brand">
            <div className="brand-logo" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 7l-8-4-8 4 8 4 8-4zm-8 6l-8-4v8l8 4 8-4v-8l-8 4z" />
              </svg>
            </div>
            <div>
              <div className="brand-title">StockPilot</div>
              <div className="brand-subtitle font-mono">WAREHOUSE INVENTORY OPS</div>
            </div>
          </div>

          <div className="header-status-indicator">
            <span className="live-pulse" />
            <span className="live-text font-mono">SYSTEM ONLINE · AP-SOUTH-1</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="app-main">
        <div className="content-container">
          {/* Global error banner (e.g. backend unreachable) */}
          <ErrorBanner
            error={globalError}
            onRetry={() => loadData(false)}
            onDismiss={() => setGlobalError(null)}
          />

          {/* Stats Strip */}
          <StatsStrip
            stats={stats}
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
          />

          {/* Controls Bar: Filter tabs, search, refresh, register button */}
          <FilterBar
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenCreate={() => {
              setCreateApiError("");
              setCreateModalOpen(true);
            }}
            onRefresh={() => loadData(true)}
            refreshing={refreshing}
          />

          {/* Inventory Table */}
          <ItemTable
            items={filteredItems}
            loading={loading}
            onIssueSuccess={handleIssueSuccess}
            onOpenDelete={openDeleteDialog}
            onOpenCreate={() => {
              setCreateApiError("");
              setCreateModalOpen(true);
            }}
            activeFilter={activeFilter}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-container">
          <div className="footer-meta font-mono">
            <span>STOCKPILOT v1.0.0</span>
            <span>·</span>
            <span>DB CONSTRAINTS: CHECK (quantity &gt;= 0)</span>
            <span>·</span>
            <span>METRIC: units_issued_total</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CreateItemModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
        submitting={submittingCreate}
        apiError={createApiError}
      />

      <DeleteModal
        isOpen={deleteModalOpen}
        item={itemToDelete}
        onClose={() => {
          setDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        deleting={submittingDelete}
        error={deleteApiError}
      />
    </div>
  );
}
