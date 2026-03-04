import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle, X, Send, Minimize2, Bot, User,
  Loader, AlertCircle, RefreshCw, ChevronDown
} from 'lucide-react';
import {
  useAuthStore, useEntriesStore, useTaxStore,
  useDeductionsStore, useRemindersStore, useBankStore,
  useSettingsStore
} from '../../store';
import { chatWithAssistant } from '../../services/supabase';

const getWelcomeMessage = (organization) => {
  const bt = (organization?.business_type || '').toLowerCase();
  const isSoleProp = bt.includes('sole') || bt.includes('individual');
  const isPartnership = bt.includes('partnership');
  const isCompany = bt.includes('limited') || bt.includes('plc');

  let taxLine;
  if (isSoleProp || isPartnership) {
    taxLine = '• **PAYE / Personal Income Tax** – calculate your annual tax liability\n• **VAT** – if your turnover exceeds ₦25 million';
  } else if (isCompany) {
    taxLine = '• **CIT** – Company Income Tax + Education Tax calculations\n• **PAYE** – monthly employee tax deductions\n• **VAT** – monthly return preparation';
  } else {
    taxLine = '• **Tax calculations** – PAYE, CIT, VAT, WHT estimates';
  }

  return {
    role: 'assistant',
    content: `Hello! I'm **TaxWise AI**, your personal tax and finance assistant for **${organization?.name || 'your business'}**.

I have full access to your financial data and can help you with:

${taxLine}
• **Audit readiness** – review your entries and flag issues
• **Deductions advice** – identify what you can claim under Nigerian law
• **Filing guidance** – step-by-step FIRS e-filing instructions
• **Cash flow analysis** – income vs expenses insights
• **Tax deadlines** – upcoming FIRS obligations

What would you like help with today?`
  };
};

const getSuggestedPrompts = (organization) => {
  const bt = (organization?.business_type || '').toLowerCase();
  const isSoleProp = bt.includes('sole') || bt.includes('individual');
  if (isSoleProp) {
    return [
      'Am I audit ready?',
      'Calculate my PAYE for this year',
      'What deductions can I claim?',
      'Do I need to register for VAT?',
      'What are my tax deadlines?',
      'Analyze my cash flow'
    ];
  }
  if (bt.includes('partnership')) {
    return [
      'Am I audit ready?',
      'Calculate PAYE for each partner',
      'What deductions are allowable?',
      'What are my filing deadlines?',
      'Do I need to file VAT returns?',
      'Analyze my cash flow'
    ];
  }
  return [
    'Am I audit ready?',
    'Estimate my CIT for this year',
    'What deductions am I missing?',
    'Help me prepare my VAT return',
    'What are my upcoming tax deadlines?',
    'Analyze my cash flow'
  ];
};

const buildContext = ({ user, organization, entries, calculations, deductions, reminders, accounts }) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);

  const yearEntries = entries.filter(e => new Date(e.date || e.createdAt) >= startOfYear);
  const totalIncome = yearEntries.filter(e => e.entry_type === 'income').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalExpenses = yearEntries.filter(e => e.entry_type === 'expense').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalDeductions = deductions.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
  const totalTaxLiability = calculations.reduce((s, c) => s + (parseFloat(c.net_tax_payable) || 0), 0);
  const netTaxable = totalIncome - totalDeductions;

  const overdueReminders = reminders.filter(r => r.status === 'active' && new Date(r.due_date) < now);
  const upcomingReminders = reminders.filter(r => {
    const d = new Date(r.due_date);
    return r.status === 'active' && d >= now && d <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  });

  const recentEntries = [...entries]
    .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
    .slice(0, 10);

  return {
    organization: {
      name: organization?.name || 'Unknown',
      business_type: organization?.business_type || 'unknown',
      tin: organization?.tin || 'Not set',
      state: organization?.state || 'Not set',
      industry: organization?.industry || 'Not set'
    },
    user: { name: user?.name, role: user?.role },
    financial_summary: {
      fiscal_year: currentYear,
      total_income_ytd: totalIncome,
      total_expenses_ytd: totalExpenses,
      net_cash_flow: totalIncome - totalExpenses,
      total_deductions: totalDeductions,
      net_taxable_income: netTaxable,
      total_tax_calculated: totalTaxLiability,
      total_entries: entries.length,
      total_calculations: calculations.length
    },
    deductions: deductions.slice(0, 20).map(d => ({
      description: d.description,
      amount: d.amount,
      category: d.category,
      tax_year: d.tax_year
    })),
    recent_entries: recentEntries.map(e => ({
      type: e.entry_type,
      amount: e.amount,
      category: e.category,
      description: e.description,
      date: e.date,
      source: e.source,
      status: e.status
    })),
    tax_calculations: calculations.slice(0, 5).map(c => ({
      tax_type: c.tax_type,
      fiscal_year: c.fiscal_year,
      net_tax_payable: c.net_tax_payable,
      created_at: c.createdAt
    })),
    reminders: {
      overdue: overdueReminders.map(r => ({ title: r.title, due_date: r.due_date })),
      upcoming_30_days: upcomingReminders.map(r => ({ title: r.title, due_date: r.due_date }))
    }
  };
};

const getApplicableTaxes = (businessType) => {
  const bt = (businessType || '').toLowerCase();
  if (bt.includes('sole') || bt.includes('individual')) {
    return `Business Type: Sole Proprietorship / Individual
APPLICABLE TAXES:
- PAYE (Personal Income Tax) — primary tax obligation under PITA Cap P8. Tax charged on business profit/income.
- VAT — required if annual turnover exceeds ₦25 million. File monthly FIRS Form VAT 002.
- WHT — deduct and remit when paying vendors for services/rent.
NOT APPLICABLE: CIT (Company Income Tax only applies to incorporated companies).
FILING: Annual PITA return to State IRS by 31 March. Monthly VAT returns by 21st of next month.`;
  }
  if (bt.includes('partnership')) {
    return `Business Type: Partnership
APPLICABLE TAXES:
- PAYE (Personal Income Tax) — each partner taxed individually on their share under PITA.
- VAT — required if annual turnover exceeds ₦25 million.
- WHT — applicable on qualifying payments.
FILING: Each partner files individual PITA return. Monthly VAT returns.`;
  }
  if (bt.includes('plc') || bt.includes('public')) {
    return `Business Type: Public Limited Company (PLC)
APPLICABLE TAXES:
- CIT (Company Income Tax) — primary tax. Rate: 30% for large companies (turnover > ₦100m), 20% for medium (₦25m–₦100m), 0% for small (≤₦25m). File CITA annual return.
- Education Tax — 2.5% of assessable profit. Filed alongside CIT.
- VAT — monthly returns required (Form 002). Output VAT 7.5% on taxable supplies.
- WHT — on qualifying payments to vendors/contractors.
- PAYE — deduct and remit monthly for ALL employees.
FILING: CIT return 6 months after year end. Monthly PAYE by 10th of next month. Monthly VAT by 21st.`;
  }
  // Default: limited_company
  return `Business Type: Limited Liability Company
APPLICABLE TAXES:
- CIT (Company Income Tax) — primary tax. Rate: 30% (large, >₦100m turnover), 20% (medium, ₦25m–₦100m), 0% (small, ≤₦25m). Under CITA Cap C21.
- Education Tax — 2.5% of assessable profit (Finance Act 2023).
- VAT — 7.5% on taxable supplies. Monthly returns if registered.
- WHT — deduct when paying for professional services, rent, dividends.
- PAYE — monthly deduction and remittance for all employees.
FILING: CIT return within 6 months of financial year end. Monthly PAYE by 10th. Monthly VAT by 21st.`;
};

const SYSTEM_PROMPT = (ctx) => `You are TaxWise AI, an expert Nigerian tax and finance assistant embedded inside the TaxWise accounting application. You have complete access to the user's financial data and must provide specific, actionable advice tailored to their exact business type and financial situation.

## User & Organization
- Organization: ${ctx.organization.name}
- Business Type: ${ctx.organization.business_type}
- TIN: ${ctx.organization.tin}
- State: ${ctx.organization.state}
- Industry: ${ctx.organization.industry}
- User: ${ctx.user.name} (${ctx.user.role})

## ${getApplicableTaxes(ctx.organization.business_type)}

## Financial Summary (${ctx.financial_summary.fiscal_year} YTD)
- Total Income: ₦${Number(ctx.financial_summary.total_income_ytd).toLocaleString()}
- Total Expenses: ₦${Number(ctx.financial_summary.total_expenses_ytd).toLocaleString()}
- Net Cash Flow: ₦${Number(ctx.financial_summary.net_cash_flow).toLocaleString()}
- Total Deductions Recorded: ₦${Number(ctx.financial_summary.total_deductions).toLocaleString()}
- Net Taxable Income (after deductions): ₦${Number(ctx.financial_summary.net_taxable_income).toLocaleString()}
- Tax Already Calculated: ₦${Number(ctx.financial_summary.total_tax_calculated).toLocaleString()}
- Total Entries: ${ctx.financial_summary.total_entries}
- Tax Calculations Saved: ${ctx.financial_summary.total_calculations}

## Deductions on Record
${ctx.deductions.length ? ctx.deductions.map(d => `- ${d.description}: ₦${Number(d.amount).toLocaleString()} (${d.category}, ${d.tax_year})`).join('\n') : 'None recorded yet.'}

## Recent Entries (last 10)
${ctx.recent_entries.length ? ctx.recent_entries.map(e => `- [${e.type?.toUpperCase()}] ₦${Number(e.amount).toLocaleString()} – ${e.description || e.category} on ${e.date} (source: ${e.source || 'manual'})`).join('\n') : 'No entries yet.'}

## Tax Calculations Saved
${ctx.tax_calculations.length ? ctx.tax_calculations.map(c => `- ${c.tax_type?.toUpperCase()} ${c.fiscal_year}: ₦${Number(c.net_tax_payable || c.result_data?.netTaxPayable || 0).toLocaleString()} payable`).join('\n') : 'No calculations saved yet.'}

## Reminders
Overdue: ${ctx.reminders.overdue.length ? ctx.reminders.overdue.map(r => r.title).join(', ') : 'None'}
Upcoming (30 days): ${ctx.reminders.upcoming_30_days.length ? ctx.reminders.upcoming_30_days.map(r => `${r.title} (${r.due_date})`).join(', ') : 'None'}

## Your Role & Guidelines
1. ALWAYS reference the business type above to determine which taxes apply. Never recommend CIT to sole proprietors; never recommend only PAYE to incorporated companies.
2. Base ALL advice on the ACTUAL financial data shown above. Quote specific numbers.
3. For audit readiness: flag missing TIN, entries with no category, gaps in records, suspicious patterns, unclaimed deductions.
4. For tax filing: give step-by-step FIRS e-filing guidance specific to their business type (CIT vs PITA, monthly VAT, monthly PAYE).
5. For deductions: identify what qualifies under Nigerian tax law for their specific entity type.
6. Be concise, use bullet points, always give a clear NEXT ACTION.
7. If you detect issues (overdue filings, underreported income, unclaimed deductions), proactively flag them with severity.
8. Use Nigerian Naira (₦) for all amounts.
9. Nigerian tax law: Finance Act 2023, CITA Cap C21, PITA Cap P8, VATA Cap V1, FIRS Act.`;

const formatMessage = (text) => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^• /gm, '&bull; ')
    .replace(/\n/g, '<br/>');
};

// Prompts are now dynamic — see getSuggestedPrompts(organization)

const Chatbot = () => {
  const { user, organization } = useAuthStore();
  const { entries } = useEntriesStore();
  const { calculations } = useTaxStore();
  const { deductions } = useDeductionsStore();
  const { reminders } = useRemindersStore();
  const { accounts } = useBankStore();

  const welcomeMessage = getWelcomeMessage(organization);
  const suggestedPrompts = getSuggestedPrompts(organization);

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized, messages]);

  const sendMessage = useCallback(async (text) => {
    const userText = (text || input).trim();
    if (!userText || isLoading) return;

    setInput('');
    setError(null);
    setShowSuggestions(false);

    const userMessage = { role: 'user', content: userText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const ctx = buildContext({ user, organization, entries, calculations, deductions, reminders, accounts });
      const systemPrompt = SYSTEM_PROMPT(ctx);

      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...updatedMessages.filter(m => m.role !== 'system').map(m => ({
          role: m.role,
          content: m.content
        }))
      ];

      const response = await chatWithAssistant(apiMessages, ctx);
      const assistantReply = response.reply || response.message || response.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

      setMessages(prev => [...prev, { role: 'assistant', content: assistantReply }]);
    } catch (err) {
      console.error('Chat error:', err);
      setError(err.message || 'Chat assistant is temporarily unavailable.');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I'm having trouble connecting right now. Please try again in a moment.\n\n*Error: ${err.message}*`
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, user, organization, entries, calculations, deductions, reminders, accounts]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleReset = () => {
    setMessages([getWelcomeMessage(organization)]);
    setShowSuggestions(true);
    setError(null);
    setInput('');
  };

  const unreadCount = 0;

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          style={styles.floatingBtn}
          onClick={() => { setIsOpen(true); setIsMinimized(false); }}
          title="Open TaxWise AI"
        >
          <Bot size={24} color="white" />
          <span style={styles.floatingBtnLabel}>AI</span>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div style={{ ...styles.panel, ...(isMinimized ? styles.panelMinimized : {}) }}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <div style={styles.headerAvatar}>
                <Bot size={18} color="white" />
              </div>
              <div>
                <div style={styles.headerTitle}>TaxWise AI</div>
                <div style={styles.headerSubtitle}>
                  {isLoading ? 'Thinking...' : 'Tax & Finance Assistant'}
                </div>
              </div>
            </div>
            <div style={styles.headerActions}>
              <button style={styles.iconBtn} onClick={handleReset} title="New conversation">
                <RefreshCw size={15} />
              </button>
              <button
                style={styles.iconBtn}
                onClick={() => setIsMinimized(v => !v)}
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <ChevronDown size={15} /> : <Minimize2 size={15} />}
              </button>
              <button style={styles.iconBtn} onClick={() => setIsOpen(false)} title="Close">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Body */}
          {!isMinimized && (
            <>
              <div style={styles.messages}>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      ...styles.messageRow,
                      ...(msg.role === 'user' ? styles.messageRowUser : {})
                    }}
                  >
                    {msg.role === 'assistant' && (
                      <div style={styles.avatarSmall}>
                        <Bot size={13} color="white" />
                      </div>
                    )}
                    <div
                      style={{
                        ...styles.bubble,
                        ...(msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant)
                      }}
                      dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                    />
                    {msg.role === 'user' && (
                      <div style={{ ...styles.avatarSmall, backgroundColor: '#2563EB' }}>
                        <User size={13} color="white" />
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div style={styles.messageRow}>
                    <div style={styles.avatarSmall}>
                      <Bot size={13} color="white" />
                    </div>
                    <div style={{ ...styles.bubble, ...styles.bubbleAssistant, ...styles.typingBubble }}>
                      <span style={styles.typingDot} />
                      <span style={{ ...styles.typingDot, animationDelay: '0.2s' }} />
                      <span style={{ ...styles.typingDot, animationDelay: '0.4s' }} />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Suggested Prompts */}
              {showSuggestions && messages.length <= 1 && (
                <div style={styles.suggestions}>
                  {suggestedPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      style={styles.suggestionBtn}
                      onClick={() => sendMessage(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div style={styles.inputArea}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about taxes, deductions, audit, filing..."
                  style={styles.textarea}
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  style={{
                    ...styles.sendBtn,
                    ...((!input.trim() || isLoading) ? styles.sendBtnDisabled : {})
                  }}
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                >
                  {isLoading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                </button>
              </div>

              <div style={styles.footer}>
                Powered by AI · Data stays private · Not a substitute for professional advice
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes typing { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
      `}</style>
    </>
  );
};

const styles = {
  floatingBtn: {
    position: 'fixed',
    bottom: '28px',
    right: '28px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    boxShadow: '0 4px 24px rgba(37, 99, 235, 0.5)',
    zIndex: 9999,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
  },
  floatingBtnLabel: {
    fontSize: '9px',
    fontWeight: '700',
    color: 'white',
    letterSpacing: '0.05em'
  },
  panel: {
    position: 'fixed',
    bottom: '28px',
    right: '28px',
    width: '400px',
    height: '580px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'fadeIn 0.2s ease'
  },
  panelMinimized: {
    height: '60px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    background: 'linear-gradient(135deg, #1D2D4F 0%, #2D1B4E 100%)',
    borderBottom: '1px solid #30363D',
    flexShrink: 0
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  headerAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#E6EDF3'
  },
  headerSubtitle: {
    fontSize: '11px',
    color: '#8B949E'
  },
  headerActions: {
    display: 'flex',
    gap: '4px'
  },
  iconBtn: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: '#8B949E',
    cursor: 'pointer'
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    scrollbarWidth: 'thin',
    scrollbarColor: '#30363D transparent'
  },
  messageRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    animation: 'fadeIn 0.2s ease'
  },
  messageRowUser: {
    flexDirection: 'row-reverse'
  },
  avatarSmall: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '2px'
  },
  bubble: {
    maxWidth: '82%',
    padding: '10px 14px',
    borderRadius: '12px',
    fontSize: '13px',
    lineHeight: '1.55',
    wordBreak: 'break-word'
  },
  bubbleAssistant: {
    backgroundColor: '#21262D',
    color: '#E6EDF3',
    borderTopLeftRadius: '4px'
  },
  bubbleUser: {
    backgroundColor: '#2563EB',
    color: 'white',
    borderTopRightRadius: '4px'
  },
  typingBubble: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    padding: '14px 16px'
  },
  typingDot: {
    display: 'inline-block',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: '#8B949E',
    animation: 'typing 1.2s infinite ease-in-out'
  },
  suggestions: {
    padding: '0 12px 8px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px'
  },
  suggestionBtn: {
    padding: '5px 10px',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    border: '1px solid rgba(37, 99, 235, 0.3)',
    borderRadius: '9999px',
    color: '#60A5FA',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  inputArea: {
    display: 'flex',
    gap: '8px',
    padding: '10px 14px',
    borderTop: '1px solid #30363D',
    alignItems: 'flex-end',
    flexShrink: 0
  },
  textarea: {
    flex: 1,
    padding: '10px 12px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '10px',
    color: '#E6EDF3',
    fontSize: '13px',
    resize: 'none',
    outline: 'none',
    lineHeight: '1.5',
    minHeight: '40px',
    maxHeight: '100px',
    overflowY: 'auto',
    fontFamily: 'inherit'
  },
  sendBtn: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'white',
    flexShrink: 0
  },
  sendBtnDisabled: {
    background: '#21262D',
    cursor: 'not-allowed'
  },
  footer: {
    fontSize: '10px',
    color: '#6E7681',
    textAlign: 'center',
    padding: '6px 14px 10px',
    flexShrink: 0
  }
};

export default Chatbot;
