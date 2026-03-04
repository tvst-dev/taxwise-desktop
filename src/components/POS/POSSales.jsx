import React, { useState } from 'react';
import {
  ShoppingCart, Search, Plus, Minus, Trash2, CreditCard,
  Banknote, Smartphone, Receipt, X, Package, Settings,
  Edit2, Check, AlertCircle, Grid, List
} from 'lucide-react';
import { usePOSStore, useFeaturesStore, useAuthStore, useEntriesStore } from '../../store';
import {
  createProduct, updateProduct as dbUpdateProduct,
  deleteProduct, createPOSTransaction, createEntry
} from '../../services/supabase';
import toast from 'react-hot-toast';

const POSSales = () => {
  const { posEnabled } = useFeaturesStore();
  const { user, organization } = useAuthStore();
  const { addEntry } = useEntriesStore();
  const {
    products, cart, transactions,
    addProduct, updateProduct, removeProduct,
    addToCart, updateCartItem, removeFromCart, clearCart,
    addTransaction, getCartTotal
  } = usePOSStore();

  const [view, setView] = useState('sales');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [productForm, setProductForm] = useState({
    name: '', price: '', category: 'general', stock: '', vatApplicable: true
  });

  // Check if POS is enabled
  if (!posEnabled) {
    return (
      <div style={styles.disabledContainer}>
        <div style={styles.disabledCard}>
          <ShoppingCart size={64} style={{ color: '#8B949E', marginBottom: 24 }} />
          <h2 style={styles.disabledTitle}>POS Feature Not Enabled</h2>
          <p style={styles.disabledText}>
            Upgrade to SME or Enterprise plan to access Point of Sale features.
          </p>
          <a href="#/settings" style={styles.enableLink}>Go to Settings</a>
        </div>
      </div>
    );
  }

  const categories = ['all', 'general', 'food', 'drinks', 'electronics', 'clothing', 'services', 'other'];
  
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const cartTotals = getCartTotal();

  const handleAddToCart = (product) => {
    if (product.stock !== undefined && product.stock <= 0) {
      toast.error('Product out of stock');
      return;
    }
    addToCart(product);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (!organization?.id) {
      toast.error('Organization not loaded. Please log out and back in.');
      return;
    }

    const cash = parseFloat(cashReceived) || 0;
    if (paymentMethod === 'cash' && cash < cartTotals.total) {
      toast.error('Insufficient cash received');
      return;
    }

    const reference = `POS-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];

    // Local transaction object (for store + receipt display)
    const transaction = {
      id: reference,
      items: [...cart],
      subtotal: cartTotals.subtotal,
      vat: cartTotals.vat,
      total: cartTotals.total,
      paymentMethod,
      cashReceived: paymentMethod === 'cash' ? cash : null,
      change: paymentMethod === 'cash' ? cash - cartTotals.total : 0,
      reference,
      customerName: customerName || 'Walk-in Customer',
      date: new Date().toISOString(),
      cashier: user?.name || 'System'
    };

    // Persist POS transaction to Supabase (column names from pos_transactions schema)
    try {
      await createPOSTransaction({
        organization_id: organization?.id,
        reference,
        items: cart.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
        subtotal: cartTotals.subtotal,
        vat_amount: cartTotals.vat,
        total: cartTotals.total,
        payment_method: paymentMethod,
        customer_name: customerName || 'Walk-in Customer'
      });
    } catch (e) {
      console.error('POS transaction DB save error:', e);
      toast.error(`Transaction not saved to DB: ${e.message || 'Database error'}`);
    }

    // Persist income entry to Supabase
    // Note: 'source' is stored in metadata to avoid schema cache issues
    const entryPayload = {
      organization_id: organization?.id,
      entry_type: 'income',
      category: 'Sales',
      amount: cartTotals.total,
      date: today,
      description: `POS Sale - ${cart.length} item(s) - ${customerName || 'Walk-in'}`,
      vendor_customer: customerName || 'Walk-in Customer',
      reference_number: reference,
      payment_method: paymentMethod,
      vat_amount: cartTotals.vat,
      status: 'approved',
      metadata: { source: 'pos', cashier: user?.name || 'System' }
    };

    try {
      const savedEntry = await createEntry(entryPayload);
      addEntry(savedEntry);
    } catch (e) {
      console.error('POS entry DB save error:', e);
      toast.error(`Entry not saved to DB: ${e.message || 'Database error'}`);
      addEntry({ ...entryPayload, id: `entry-${Date.now()}`, createdAt: new Date().toISOString() });
    }

    addTransaction(transaction);
    setLastTransaction(transaction);
    setShowReceipt(true);
    clearCart();
    setCashReceived('');
    setCustomerName('');
    toast.success('Sale completed & entry created!');
  };

  const handleSaveProduct = async () => {
    if (!productForm.name || !productForm.price) {
      toast.error('Name and price are required');
      return;
    }

    if (!organization?.id) {
      toast.error('Organization not loaded. Please log out and back in.');
      return;
    }

    // Map local field names to DB column names
    const dbData = {
      name: productForm.name,
      price: parseFloat(productForm.price),
      category: productForm.category,
      stock_quantity: productForm.stock ? parseInt(productForm.stock) : null,
      is_vat_applicable: productForm.vatApplicable,
      organization_id: organization?.id
    };

    try {
      if (editingProduct) {
        const saved = await dbUpdateProduct(editingProduct.id, dbData);
        updateProduct(editingProduct.id, { ...saved, stock: saved.stock_quantity, vatApplicable: saved.is_vat_applicable });
        toast.success('Product updated');
      } else {
        const saved = await createProduct(dbData);
        addProduct({ ...saved, stock: saved.stock_quantity, vatApplicable: saved.is_vat_applicable });
        toast.success('Product added');
      }
    } catch (e) {
      console.error('POS product DB save error:', e);
      toast.error(`Save failed: ${e.message || 'Database error'}`);
      // Fallback: save locally only
      const localData = {
        id: editingProduct?.id || `prod-${Date.now()}`,
        name: productForm.name,
        price: parseFloat(productForm.price),
        category: productForm.category,
        stock: productForm.stock ? parseInt(productForm.stock) : null,
        vatApplicable: productForm.vatApplicable
      };
      if (editingProduct) {
        updateProduct(editingProduct.id, localData);
      } else {
        addProduct(localData);
      }
    }

    setShowProductModal(false);
    setEditingProduct(null);
    setProductForm({ name: '', price: '', category: 'general', stock: '', vatApplicable: true });
  };

  const formatCurrency = (amount) => `₦${(amount || 0).toLocaleString()}`;

  // Sales View
  const renderSalesView = () => (
    <div style={styles.salesContainer}>
      {/* Products Grid */}
      <div style={styles.productsSection}>
        <div style={styles.searchBar}>
          <Search size={18} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.categoryTabs}>
          {categories.map(cat => (
            <button
              key={cat}
              style={{
                ...styles.categoryTab,
                ...(selectedCategory === cat ? styles.categoryTabActive : {})
              }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <div style={styles.productsGrid}>
          {filteredProducts.length === 0 ? (
            <div style={styles.emptyProducts}>
              <Package size={48} color="#30363D" />
              <p>No products found</p>
              <button style={styles.addProductBtn} onClick={() => setShowProductModal(true)}>
                <Plus size={16} /> Add Product
              </button>
            </div>
          ) : (
            filteredProducts.map(product => (
              <div
                key={product.id}
                style={styles.productCard}
                onClick={() => handleAddToCart(product)}
              >
                <div style={styles.productName}>{product.name}</div>
                <div style={styles.productPrice}>{formatCurrency(product.price)}</div>
                {product.stock !== null && (
                  <div style={styles.productStock}>Stock: {product.stock}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Cart */}
      <div style={styles.cartSection}>
        <div style={styles.cartHeader}>
          <ShoppingCart size={20} />
          <span>Current Sale</span>
          <span style={styles.cartCount}>{cart.length}</span>
        </div>

        <div style={styles.cartItems}>
          {cart.length === 0 ? (
            <div style={styles.emptyCart}>
              <Receipt size={32} color="#30363D" />
              <p>No items in cart</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={index} style={styles.cartItem}>
                <div style={styles.cartItemInfo}>
                  <div style={styles.cartItemName}>{item.name}</div>
                  <div style={styles.cartItemPrice}>{formatCurrency(item.price)} × {item.quantity}</div>
                </div>
                <div style={styles.cartItemActions}>
                  <button style={styles.qtyBtn} onClick={() => updateCartItem(item.productId, Math.max(1, item.quantity - 1))}>
                    <Minus size={14} />
                  </button>
                  <span style={styles.qtyValue}>{item.quantity}</span>
                  <button style={styles.qtyBtn} onClick={() => updateCartItem(item.productId, item.quantity + 1)}>
                    <Plus size={14} />
                  </button>
                  <button style={styles.removeBtn} onClick={() => removeFromCart(item.productId)}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div style={styles.cartItemTotal}>{formatCurrency(item.price * item.quantity)}</div>
              </div>
            ))
          )}
        </div>

        {/* Customer Name */}
        <div style={styles.customerInput}>
          <input
            type="text"
            placeholder="Customer name (optional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            style={styles.input}
          />
        </div>

        {/* Cart Totals */}
        <div style={styles.cartTotals}>
          <div style={styles.totalRow}>
            <span>Subtotal</span>
            <span>{formatCurrency(cartTotals.subtotal)}</span>
          </div>
          <div style={styles.totalRow}>
            <span>VAT (7.5%)</span>
            <span>{formatCurrency(cartTotals.vat)}</span>
          </div>
          <div style={{ ...styles.totalRow, ...styles.grandTotal }}>
            <span>Total</span>
            <span>{formatCurrency(cartTotals.total)}</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div style={styles.paymentMethods}>
          {[
            { id: 'cash', icon: Banknote, label: 'Cash' },
            { id: 'card', icon: CreditCard, label: 'Card' },
            { id: 'transfer', icon: Smartphone, label: 'Transfer' }
          ].map(method => (
            <button
              key={method.id}
              style={{
                ...styles.paymentBtn,
                ...(paymentMethod === method.id ? styles.paymentBtnActive : {})
              }}
              onClick={() => setPaymentMethod(method.id)}
            >
              <method.icon size={18} />
              <span>{method.label}</span>
            </button>
          ))}
        </div>

        {/* Cash Input */}
        {paymentMethod === 'cash' && (
          <div style={styles.cashInput}>
            <label style={styles.label}>Cash Received</label>
            <input
              type="number"
              placeholder="0.00"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              style={styles.input}
            />
            {cashReceived && parseFloat(cashReceived) >= cartTotals.total && (
              <div style={styles.changeAmount}>
                Change: {formatCurrency(parseFloat(cashReceived) - cartTotals.total)}
              </div>
            )}
          </div>
        )}

        {/* Checkout Button */}
        <button
          style={{
            ...styles.checkoutBtn,
            opacity: cart.length === 0 ? 0.5 : 1
          }}
          onClick={handleCheckout}
          disabled={cart.length === 0}
        >
          <Check size={20} />
          Complete Sale - {formatCurrency(cartTotals.total)}
        </button>
      </div>
    </div>
  );

  // Products Management View
  const renderProductsView = () => (
    <div style={styles.productsManagement}>
      <div style={styles.managementHeader}>
        <h2 style={styles.managementTitle}>Products</h2>
        <button style={styles.addBtn} onClick={() => setShowProductModal(true)}>
          <Plus size={16} /> Add Product
        </button>
      </div>
      
      <div style={styles.productsList}>
        {products.length === 0 ? (
          <div style={styles.emptyState}>
            <Package size={64} color="#30363D" />
            <p>No products yet</p>
            <button style={styles.addProductBtn} onClick={() => setShowProductModal(true)}>
              <Plus size={16} /> Add Your First Product
            </button>
          </div>
        ) : (
          products.map(product => (
            <div key={product.id} style={styles.productListItem}>
              <div style={styles.productListInfo}>
                <div style={styles.productListName}>{product.name}</div>
                <div style={styles.productListMeta}>
                  {product.category} • {product.stock !== null ? `Stock: ${product.stock}` : 'No stock tracking'}
                </div>
              </div>
              <div style={styles.productListPrice}>{formatCurrency(product.price)}</div>
              <div style={styles.productListActions}>
                <button style={styles.editBtn} onClick={() => { setEditingProduct(product); setProductForm(product); setShowProductModal(true); }}>
                  <Edit2 size={14} />
                </button>
                <button style={styles.deleteBtn} onClick={async () => { try { await deleteProduct(product.id); } catch (e) { console.warn('DB delete failed:', e.message); } removeProduct(product.id); toast.success('Product deleted'); }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // History View
  const renderHistoryView = () => (
    <div style={styles.historyContainer}>
      <h2 style={styles.historyTitle}>Transaction History</h2>
      {transactions.length === 0 ? (
        <div style={styles.emptyState}>
          <Receipt size={64} color="#30363D" />
          <p>No transactions yet</p>
        </div>
      ) : (
        <div style={styles.transactionsList}>
          {transactions.slice().reverse().map((txn, i) => (
            <div key={i} style={styles.transactionItem}>
              <div style={styles.txnInfo}>
                <div style={styles.txnRef}>{txn.reference}</div>
                <div style={styles.txnMeta}>
                  {new Date(txn.date).toLocaleString()} • {txn.paymentMethod} • {txn.items.length} items
                </div>
              </div>
              <div style={styles.txnAmount}>{formatCurrency(txn.total)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={styles.container}>
      {/* Navigation Tabs */}
      <div style={styles.navTabs}>
        {['sales', 'products', 'history'].map(v => (
          <button
            key={v}
            style={{ ...styles.navTab, ...(view === v ? styles.navTabActive : {}) }}
            onClick={() => setView(v)}
          >
            {v === 'sales' && <ShoppingCart size={18} />}
            {v === 'products' && <Package size={18} />}
            {v === 'history' && <Receipt size={18} />}
            <span>{v.charAt(0).toUpperCase() + v.slice(1)}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {view === 'sales' && renderSalesView()}
      {view === 'products' && renderProductsView()}
      {view === 'history' && renderHistoryView()}

      {/* Receipt Modal */}
      {showReceipt && lastTransaction && (
        <div style={styles.modalOverlay} onClick={() => setShowReceipt(false)}>
          <div style={styles.receiptModal} onClick={e => e.stopPropagation()}>
            <div style={styles.receiptHeader}>
              <h3>Receipt</h3>
              <button style={styles.closeBtn} onClick={() => setShowReceipt(false)}><X size={20} /></button>
            </div>
            <div style={styles.receiptContent}>
              <div style={styles.receiptOrg}>{organization?.name || 'TaxWise POS'}</div>
              <div style={styles.receiptRef}>Ref: {lastTransaction.reference}</div>
              <div style={styles.receiptDate}>{new Date(lastTransaction.date).toLocaleString()}</div>
              <div style={styles.receiptDivider} />
              {lastTransaction.items.map((item, i) => (
                <div key={i} style={styles.receiptItem}>
                  <span>{item.name} x{item.quantity}</span>
                  <span>{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
              <div style={styles.receiptDivider} />
              <div style={styles.receiptTotal}>
                <span>Subtotal</span><span>{formatCurrency(lastTransaction.subtotal)}</span>
              </div>
              <div style={styles.receiptTotal}>
                <span>VAT</span><span>{formatCurrency(lastTransaction.vat)}</span>
              </div>
              <div style={{ ...styles.receiptTotal, fontWeight: 700, fontSize: 18 }}>
                <span>Total</span><span>{formatCurrency(lastTransaction.total)}</span>
              </div>
              <div style={styles.receiptDivider} />
              <div style={styles.receiptPayment}>
                Paid via {lastTransaction.paymentMethod}
                {lastTransaction.paymentMethod === 'cash' && ` • Change: ${formatCurrency(lastTransaction.change)}`}
              </div>
              <div style={styles.receiptFooter}>Thank you!</div>
            </div>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {showProductModal && (
        <div style={styles.modalOverlay} onClick={() => setShowProductModal(false)}>
          <div style={styles.productModal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
              <button style={styles.closeBtn} onClick={() => { setShowProductModal(false); setEditingProduct(null); }}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Product Name *</label>
                <input type="text" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} placeholder="e.g., Coca Cola 50cl" style={styles.input} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Price (₦) *</label>
                <input type="number" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })} placeholder="0.00" style={styles.input} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Category</label>
                <select value={productForm.category} onChange={e => setProductForm({ ...productForm, category: e.target.value })} style={styles.input}>
                  {categories.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Stock Quantity</label>
                <input type="number" value={productForm.stock} onChange={e => setProductForm({ ...productForm, stock: e.target.value })} placeholder="Leave empty for unlimited" style={styles.input} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.checkboxLabel}>
                  <input type="checkbox" checked={productForm.vatApplicable} onChange={e => setProductForm({ ...productForm, vatApplicable: e.target.checked })} />
                  <span>VAT Applicable (7.5%)</span>
                </label>
              </div>
              <button style={styles.saveBtn} onClick={handleSaveProduct}>
                <Check size={16} /> {editingProduct ? 'Update Product' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#0D1117' },
  navTabs: { display: 'flex', gap: 8, padding: 16, borderBottom: '1px solid #30363D' },
  navTab: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid #30363D', borderRadius: 8, color: '#8B949E', fontSize: 14, cursor: 'pointer' },
  navTabActive: { backgroundColor: '#2563EB', borderColor: '#2563EB', color: '#fff' },
  salesContainer: { flex: 1, display: 'flex', overflow: 'hidden' },
  productsSection: { flex: 1, display: 'flex', flexDirection: 'column', padding: 16, overflow: 'hidden' },
  searchBar: { position: 'relative', marginBottom: 16 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8B949E' },
  searchInput: { width: '100%', padding: '10px 12px 10px 40px', backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8, color: '#E6EDF3', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  categoryTabs: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  categoryTab: { padding: '6px 12px', backgroundColor: '#21262D', border: 'none', borderRadius: 16, color: '#8B949E', fontSize: 12, cursor: 'pointer' },
  categoryTabActive: { backgroundColor: '#2563EB', color: '#fff' },
  productsGrid: { flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, overflow: 'auto', alignContent: 'start' },
  productCard: { padding: 16, backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s' },
  productName: { fontSize: 14, fontWeight: 500, color: '#E6EDF3', marginBottom: 8 },
  productPrice: { fontSize: 16, fontWeight: 600, color: '#22C55E' },
  productStock: { fontSize: 12, color: '#8B949E', marginTop: 4 },
  emptyProducts: { gridColumn: '1/-1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, color: '#6E7681' },
  addProductBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', backgroundColor: '#2563EB', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, cursor: 'pointer', marginTop: 16 },
  cartSection: { width: 360, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #30363D', backgroundColor: '#161B22' },
  cartHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderBottom: '1px solid #30363D', color: '#E6EDF3', fontWeight: 600 },
  cartCount: { marginLeft: 'auto', backgroundColor: '#2563EB', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 12 },
  cartItems: { flex: 1, overflow: 'auto', padding: 12 },
  emptyCart: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6E7681' },
  cartItem: { display: 'flex', flexDirection: 'column', gap: 8, padding: 12, backgroundColor: '#0D1117', borderRadius: 8, marginBottom: 8 },
  cartItemInfo: { display: 'flex', justifyContent: 'space-between' },
  cartItemName: { fontSize: 14, fontWeight: 500, color: '#E6EDF3' },
  cartItemPrice: { fontSize: 12, color: '#8B949E' },
  cartItemActions: { display: 'flex', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#21262D', border: 'none', borderRadius: 4, color: '#E6EDF3', cursor: 'pointer' },
  qtyValue: { width: 32, textAlign: 'center', color: '#E6EDF3', fontSize: 14 },
  removeBtn: { marginLeft: 'auto', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' },
  cartItemTotal: { textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#22C55E' },
  customerInput: { padding: '0 12px' },
  input: { width: '100%', padding: 10, backgroundColor: '#0D1117', border: '1px solid #30363D', borderRadius: 6, color: '#E6EDF3', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  cartTotals: { padding: 12, borderTop: '1px solid #30363D' },
  totalRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', color: '#8B949E', fontSize: 14 },
  grandTotal: { color: '#E6EDF3', fontWeight: 600, fontSize: 18, paddingTop: 12, borderTop: '1px solid #30363D' },
  paymentMethods: { display: 'flex', gap: 8, padding: 12 },
  paymentBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 12, backgroundColor: '#21262D', border: '1px solid #30363D', borderRadius: 8, color: '#8B949E', fontSize: 12, cursor: 'pointer' },
  paymentBtnActive: { backgroundColor: 'rgba(37,99,235,0.1)', borderColor: '#2563EB', color: '#2563EB' },
  cashInput: { padding: '0 12px 12px' },
  label: { display: 'block', fontSize: 12, color: '#8B949E', marginBottom: 6 },
  changeAmount: { marginTop: 8, padding: 8, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 6, color: '#22C55E', fontSize: 14, textAlign: 'center' },
  checkoutBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 12, padding: 16, backgroundColor: '#22C55E', border: 'none', borderRadius: 8, color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  productsManagement: { flex: 1, padding: 24, overflow: 'auto' },
  managementHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  managementTitle: { fontSize: 24, fontWeight: 600, color: '#E6EDF3', margin: 0 },
  addBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', backgroundColor: '#2563EB', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, cursor: 'pointer' },
  productsList: { display: 'flex', flexDirection: 'column', gap: 12 },
  productListItem: { display: 'flex', alignItems: 'center', padding: 16, backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8 },
  productListInfo: { flex: 1 },
  productListName: { fontSize: 14, fontWeight: 500, color: '#E6EDF3' },
  productListMeta: { fontSize: 12, color: '#8B949E', marginTop: 4 },
  productListPrice: { fontSize: 16, fontWeight: 600, color: '#22C55E', marginRight: 16 },
  productListActions: { display: 'flex', gap: 8 },
  editBtn: { width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#21262D', border: 'none', borderRadius: 6, color: '#8B949E', cursor: 'pointer' },
  deleteBtn: { width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 64, color: '#6E7681' },
  historyContainer: { flex: 1, padding: 24, overflow: 'auto' },
  historyTitle: { fontSize: 24, fontWeight: 600, color: '#E6EDF3', margin: '0 0 24px' },
  transactionsList: { display: 'flex', flexDirection: 'column', gap: 12 },
  transactionItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8 },
  txnInfo: { flex: 1 },
  txnRef: { fontSize: 14, fontWeight: 500, color: '#E6EDF3' },
  txnMeta: { fontSize: 12, color: '#8B949E', marginTop: 4 },
  txnAmount: { fontSize: 18, fontWeight: 600, color: '#22C55E' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  receiptModal: { width: 320, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  receiptHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#161B22', color: '#E6EDF3' },
  closeBtn: { backgroundColor: 'transparent', border: 'none', color: '#8B949E', cursor: 'pointer' },
  receiptContent: { padding: 24, color: '#1F2937' },
  receiptOrg: { fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8 },
  receiptRef: { fontSize: 12, textAlign: 'center', color: '#6B7280' },
  receiptDate: { fontSize: 12, textAlign: 'center', color: '#6B7280', marginBottom: 16 },
  receiptDivider: { borderTop: '1px dashed #D1D5DB', margin: '12px 0' },
  receiptItem: { display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' },
  receiptTotal: { display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' },
  receiptPayment: { textAlign: 'center', fontSize: 12, color: '#6B7280', marginTop: 8 },
  receiptFooter: { textAlign: 'center', fontSize: 14, fontWeight: 500, marginTop: 16 },
  productModal: { width: 400, backgroundColor: '#161B22', borderRadius: 12, overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottom: '1px solid #30363D', color: '#E6EDF3' },
  modalBody: { padding: 20 },
  formGroup: { marginBottom: 16 },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: 8, color: '#E6EDF3', fontSize: 14, cursor: 'pointer' },
  saveBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 12, backgroundColor: '#2563EB', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 8 },
  disabledContainer: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D1117' },
  disabledCard: { textAlign: 'center', padding: 48, backgroundColor: '#161B22', borderRadius: 16, border: '1px solid #30363D' },
  disabledTitle: { fontSize: 20, fontWeight: 600, color: '#E6EDF3', margin: '0 0 12px' },
  disabledText: { fontSize: 14, color: '#8B949E', margin: '0 0 24px', maxWidth: 300 },
  enableLink: { color: '#2563EB', textDecoration: 'none', fontWeight: 500 }
};

export default POSSales;
