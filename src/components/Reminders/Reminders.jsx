import React, { useState, useMemo } from 'react';
import {
  Bell, Plus, Calendar, Clock, AlertCircle, CheckCircle,
  Edit2, Trash2, X, Filter, Search
} from 'lucide-react';
import { useRemindersStore, useAuthStore } from '../../store';
import { createReminder, updateReminder as updateReminderDB, deleteReminder } from '../../services/supabase';
import toast from 'react-hot-toast';

const Reminders = () => {
  const {
    reminders, addReminder, updateReminder, removeReminder,
    markComplete, getUpcomingReminders, getOverdueReminders
  } = useRemindersStore();
  const { organization } = useAuthStore();

  const [showModal, setShowModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    due_date: '',
    due_time: '',
    reminder_type: 'tax_filing',
    priority: 'medium'
  });

  const reminderTypes = [
    { value: 'tax_filing', label: 'Tax Filing' },
    { value: 'payment', label: 'Payment Due' },
    { value: 'document', label: 'Document Submission' },
    { value: 'audit', label: 'Audit Related' },
    { value: 'other', label: 'Other' }
  ];

  const priorities = [
    { value: 'low', label: 'Low', color: '#8B949E' },
    { value: 'medium', label: 'Medium', color: '#F59E0B' },
    { value: 'high', label: 'High', color: '#EF4444' }
  ];

  // Filter and search reminders
  const filteredReminders = useMemo(() => {
    return reminders.filter(reminder => {
      const matchesSearch = !searchTerm || 
        reminder.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reminder.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      switch (filter) {
        case 'pending':
          return !reminder.completed;
        case 'completed':
          return reminder.completed;
        case 'overdue':
          return !reminder.completed && new Date(reminder.due_date) < new Date();
        default:
          return true;
      }
    }).sort((a, b) => {
      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });
  }, [reminders, filter, searchTerm]);

  const stats = useMemo(() => {
    const upcoming = getUpcomingReminders(7);
    const overdue = getOverdueReminders();
    const completed = reminders.filter(r => r.completed);
    return {
      total: reminders.length,
      upcoming: upcoming.length,
      overdue: overdue.length,
      completed: completed.length
    };
  }, [reminders, getUpcomingReminders, getOverdueReminders]);

  const handleSubmit = async () => {
    if (!form.title || !form.due_date) {
      toast.error('Please fill in required fields');
      return;
    }

    if (editingReminder) {
      try {
        const updated = await updateReminderDB(editingReminder.id, form);
        updateReminder(editingReminder.id, updated || form);
      } catch (e) {
        console.warn('DB update failed, updating locally:', e.message);
        updateReminder(editingReminder.id, form);
      }
      toast.success('Reminder updated');
    } else {
      try {
        const payload = { ...form, organization_id: organization?.id };
        const saved = await createReminder(payload);
        addReminder(saved);
      } catch (e) {
        console.warn('DB save failed, saving locally:', e.message);
        addReminder(form);
      }
      toast.success('Reminder created');
    }

    resetForm();
  };

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      due_date: '',
      due_time: '',
      reminder_type: 'tax_filing',
      priority: 'medium'
    });
    setEditingReminder(null);
    setShowModal(false);
  };

  const handleEdit = (reminder) => {
    setForm({
      title: reminder.title,
      description: reminder.description || '',
      due_date: reminder.due_date,
      due_time: reminder.due_time || '',
      reminder_type: reminder.reminder_type || 'other',
      priority: reminder.priority || 'medium'
    });
    setEditingReminder(reminder);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this reminder?')) {
      try {
        await deleteReminder(id);
      } catch (e) {
        console.warn('DB delete failed, removing locally:', e.message);
      }
      removeReminder(id);
      toast.success('Reminder deleted');
    }
  };

  const handleToggleComplete = (reminder) => {
    markComplete(reminder.id, !reminder.completed);
    toast.success(reminder.completed ? 'Marked as pending' : 'Marked as complete');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-NG', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysRemaining = (dateStr) => {
    const due = new Date(dateStr);
    const now = new Date();
    due.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    
    if (diff < 0) return { text: `${Math.abs(diff)} days overdue`, color: '#EF4444' };
    if (diff === 0) return { text: 'Due today', color: '#F59E0B' };
    if (diff === 1) return { text: 'Due tomorrow', color: '#F59E0B' };
    if (diff <= 7) return { text: `${diff} days left`, color: '#F59E0B' };
    return { text: `${diff} days left`, color: '#8B949E' };
  };

  const getPriorityStyle = (priority) => {
    const p = priorities.find(pr => pr.value === priority);
    return { backgroundColor: `${p?.color}15`, color: p?.color || '#8B949E' };
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Reminders</h1>
          <p style={styles.subtitle}>
            Track tax deadlines and important dates
          </p>
        </div>
        <button style={styles.primaryBtn} onClick={() => setShowModal(true)}>
          <Plus size={16} />
          New Reminder
        </button>
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <Bell size={20} color="#2563EB" />
          <div style={styles.statContent}>
            <span style={styles.statValue}>{stats.total}</span>
            <span style={styles.statLabel}>Total</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <Clock size={20} color="#F59E0B" />
          <div style={styles.statContent}>
            <span style={styles.statValue}>{stats.upcoming}</span>
            <span style={styles.statLabel}>This Week</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <AlertCircle size={20} color="#EF4444" />
          <div style={styles.statContent}>
            <span style={{ ...styles.statValue, color: stats.overdue > 0 ? '#EF4444' : '#E6EDF3' }}>
              {stats.overdue}
            </span>
            <span style={styles.statLabel}>Overdue</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <CheckCircle size={20} color="#22C55E" />
          <div style={styles.statContent}>
            <span style={styles.statValue}>{stats.completed}</span>
            <span style={styles.statLabel}>Completed</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.searchBox}>
          <Search size={16} color="#8B949E" />
          <input
            type="text"
            placeholder="Search reminders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">All Reminders</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Reminders List */}
      <div style={styles.remindersList}>
        {filteredReminders.length === 0 ? (
          <div style={styles.emptyState}>
            <Bell size={48} color="#30363D" />
            <h3 style={styles.emptyTitle}>No reminders found</h3>
            <p style={styles.emptyText}>
              {reminders.length === 0 
                ? "Create your first reminder to track important tax deadlines."
                : "No reminders match your current filter."
              }
            </p>
            {reminders.length === 0 && (
              <button style={styles.emptyBtn} onClick={() => setShowModal(true)}>
                <Plus size={16} />
                Create Reminder
              </button>
            )}
          </div>
        ) : (
          filteredReminders.map((reminder) => {
            const daysInfo = getDaysRemaining(reminder.due_date);
            return (
              <div 
                key={reminder.id} 
                style={{
                  ...styles.reminderCard,
                  opacity: reminder.completed ? 0.6 : 1
                }}
              >
                <button
                  style={{
                    ...styles.checkbox,
                    backgroundColor: reminder.completed ? '#22C55E' : 'transparent',
                    borderColor: reminder.completed ? '#22C55E' : '#30363D'
                  }}
                  onClick={() => handleToggleComplete(reminder)}
                >
                  {reminder.completed && <CheckCircle size={14} color="white" />}
                </button>
                
                <div style={styles.reminderContent}>
                  <div style={styles.reminderHeader}>
                    <h4 style={{
                      ...styles.reminderTitle,
                      textDecoration: reminder.completed ? 'line-through' : 'none'
                    }}>
                      {reminder.title}
                    </h4>
                    <span style={{ ...styles.priorityBadge, ...getPriorityStyle(reminder.priority) }}>
                      {reminder.priority}
                    </span>
                  </div>
                  {reminder.description && (
                    <p style={styles.reminderDesc}>{reminder.description}</p>
                  )}
                  <div style={styles.reminderMeta}>
                    <span style={styles.reminderDate}>
                      <Calendar size={12} />
                      {formatDate(reminder.due_date)}
                    </span>
                    {!reminder.completed && (
                      <span style={{ ...styles.daysRemaining, color: daysInfo.color }}>
                        {daysInfo.text}
                      </span>
                    )}
                  </div>
                </div>

                <div style={styles.reminderActions}>
                  <button 
                    style={styles.actionBtn}
                    onClick={() => handleEdit(reminder)}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    style={{ ...styles.actionBtn, color: '#EF4444' }}
                    onClick={() => handleDelete(reminder.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={resetForm}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {editingReminder ? 'Edit Reminder' : 'New Reminder'}
              </h3>
              <button style={styles.closeBtn} onClick={resetForm}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  style={styles.input}
                  placeholder="e.g., VAT Filing Deadline"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={styles.textarea}
                  placeholder="Additional details..."
                  rows={3}
                />
              </div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Due Date *</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Due Time (Optional)</label>
                  <input
                    type="time"
                    value={form.due_time}
                    onChange={(e) => setForm({ ...form, due_time: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    style={styles.select}
                  >
                    {priorities.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Type</label>
                <select
                  value={form.reminder_type}
                  onChange={(e) => setForm({ ...form, reminder_type: e.target.value })}
                  style={styles.select}
                >
                  {reminderTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.cancelBtn} onClick={resetForm}>
                Cancel
              </button>
              <button style={styles.submitBtn} onClick={handleSubmit}>
                {editingReminder ? 'Update' : 'Create'} Reminder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    minHeight: '100%',
    backgroundColor: '#0D1117'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 4px 0'
  },
  subtitle: {
    fontSize: '14px',
    color: '#8B949E',
    margin: 0
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '10px'
  },
  statContent: {
    display: 'flex',
    flexDirection: 'column'
  },
  statValue: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#E6EDF3'
  },
  statLabel: {
    fontSize: '12px',
    color: '#8B949E'
  },
  toolbar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px'
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 16px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '8px',
    flex: 1,
    maxWidth: '300px'
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none'
  },
  filterSelect: {
    padding: '10px 16px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    cursor: 'pointer',
    outline: 'none'
  },
  remindersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  reminderCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '20px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px'
  },
  checkbox: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    border: '2px solid #30363D',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    marginTop: '2px'
  },
  reminderContent: {
    flex: 1,
    minWidth: 0
  },
  reminderHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '6px'
  },
  reminderTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: 0
  },
  priorityBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
    textTransform: 'capitalize'
  },
  reminderDesc: {
    fontSize: '13px',
    color: '#8B949E',
    margin: '0 0 8px 0'
  },
  reminderMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  reminderDate: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#8B949E'
  },
  daysRemaining: {
    fontSize: '12px',
    fontWeight: '500'
  },
  reminderActions: {
    display: 'flex',
    gap: '8px'
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '6px',
    color: '#8B949E',
    cursor: 'pointer'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    textAlign: 'center',
    backgroundColor: '#161B22',
    borderRadius: '12px',
    border: '1px solid #30363D'
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '16px 0 8px'
  },
  emptyText: {
    fontSize: '14px',
    color: '#8B949E',
    margin: '0 0 24px'
  },
  emptyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 9000,
    overflowY: 'auto',
    padding: '40px 20px'
  },
  modal: {
    width: '100%',
    maxWidth: '480px',
    backgroundColor: '#161B22',
    borderRadius: '16px',
    border: '1px solid #30363D',
    overflow: 'hidden',
    flexShrink: 0
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #30363D'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: 0
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#8B949E',
    cursor: 'pointer'
  },
  modalBody: {
    padding: '24px'
  },
  modalFooter: {
    display: 'flex',
    gap: '12px',
    padding: '20px 24px',
    borderTop: '1px solid #30363D'
  },
  formGroup: {
    marginBottom: '20px',
    flex: 1
  },
  formRow: {
    display: 'flex',
    gap: '16px'
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#8B949E',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box'
  },
  cancelBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#8B949E',
    fontSize: '14px',
    cursor: 'pointer'
  },
  submitBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  }
};

export default Reminders;
