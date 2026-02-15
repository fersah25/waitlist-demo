"use client";

import React, { useState } from 'react';

// --- Types & Interfaces ---

// GoPlus Security Types
interface LpHolder {
    address: string;
    percent: string;
    is_locked?: number; // 1 if locked
    balance?: string;
}

interface GoPlusTokenSecurity {
    contract_address: string;
    is_honeypot: string; // "1" or "0"
    buy_tax: string; // e.g. "0.10" = 10%
    sell_tax: string; // e.g. "0.10" = 10%
    is_proxy: string; // "1" or "0"
    owner_address: string; // address string or ""
    lp_holder_count: string; // number as string
    is_open_source: string; // "1" or "0"
    lp_holders?: LpHolder[]; // Array of LP holders
    [key: string]: unknown; // Allow other properties
}

interface GoPlusResponse {
    code: number;
    message: string;
    result: Record<string, GoPlusTokenSecurity>;
}

// DEXScreener Types
interface DexPair {
    chainId: string;
    dexId: string;
    url: string;
    baseToken: {
        address: string;
        name: string;
        symbol: string;
    };
    liquidity?: {
        usd?: number;
    };
    priceUsd?: string;
    volume?: {
        m5: number;
        h1: number;
        h6: number;
        h24: number;
    };
    info?: {
        websites?: { label: string; url: string }[];
        socials?: { type: string; url: string }[];
    };
}

interface DexScreenerResponse {
    schemaVersion: string;
    pairs: DexPair[] | null;
}

// Analysis State Type
interface SecurityAnalysis {
    trustScore: number;
    details: GoPlusTokenSecurity;
    isRenounced: boolean;
}

// Gemini API Types
interface GeminiPart {
    text: string;
}

interface GeminiContent {
    parts: GeminiPart[];
    role?: string;
}

interface GeminiCandidate {
    content: GeminiContent;
    finishReason?: string;
    index?: number;
    safetyRatings?: unknown[];
}

interface GeminiResponse {
    candidates?: GeminiCandidate[];
    promptFeedback?: unknown;
    error?: {
        code: number;
        message: string;
        status: string;
    };
}

// Chat Message Type
interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

const BaseShield: React.FC = () => {
    // --- State ---
    const [contractAddress, setContractAddress] = useState<string>('');
    const [cleanAddress, setCleanAddress] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<SecurityAnalysis | null>(null);
    const [dexData, setDexData] = useState<DexPair | null>(null);

    // AI Chat State
    const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
    const [chatInput, setChatInput] = useState<string>('');
    const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        { role: 'assistant', content: 'Hi! I am BaseShield AI. Ask me anything about the token you just scanned!' }
    ]);

    // --- Constants ---
    const CHAIN_ID = '8453'; // Base Network
    const BURN_ADDRESSES = [
        '0x0000000000000000000000000000000000000000',
        '0x000000000000000000000000000000000000dead',
        '0xdead000000000000000042069420694206942069'
    ];

    // --- Helper Functions ---
    const formatPrice = (priceStr: string | undefined): string => {
        if (!priceStr) return '0.00';
        const price = parseFloat(priceStr);
        if (isNaN(price)) return '0.00';

        return price.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 14
        });
    };

    const formatVolume = (vol: number | undefined): string => {
        if (vol === undefined) return '$0';
        if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
        if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`;
        return `$${vol.toFixed(0)}`;
    };

    const toggleChat = () => {
        setIsChatOpen(!isChatOpen);
    };

    // --- AI Logic (Debugging Mode) ---
    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;

        const userQuestion = chatInput;
        const newHistory: ChatMessage[] = [...chatMessages, { role: 'user', content: userQuestion }];

        // Update UI immediately
        setChatMessages(newHistory);
        setChatInput('');
        setIsChatLoading(true);

        try {
            // 1. Key Retrieval & Debug Log
            const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
            console.log('Gemini Auth Check:', apiKey ? 'Key Found' : 'Key Missing');

            // 2. Strict Check: If missing, throw immediately
            if (!apiKey) {
                throw new Error('Key is missing in Env Variables!');
            }

            // 3. Construct System Prompt & Context
            const systemInstruction = "You are a helpful, witty, and smart AI assistant. Answer any question the user asks.";
            let contextData = "";

            if (dexData) {
                const price = dexData.priceUsd ? `$${dexData.priceUsd}` : 'Unknown';
                const name = dexData.baseToken.name;
                const symbol = dexData.baseToken.symbol;
                contextData += `Token: ${name} (${symbol}). Price: ${price}. `;
            }
            if (analysis) {
                contextData += `Trust Score: ${analysis.trustScore}/100. Honeypot: ${analysis.details.is_honeypot === '1' ? 'YES' : 'NO'}. `;
            }

            // Prepend context to user prompt for simplicity in this specific debugging request
            // User requested: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }] })
            // So we combine everything into one text block.
            let finalPrompt = `${systemInstruction}\n\n`;
            if (contextData) {
                finalPrompt += `Context: ${contextData}\n\n`;
            }
            finalPrompt += `User Question: ${userQuestion}`;

            // 4. API Call (Simplified Body)
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: finalPrompt }]
                    }]
                })
            });

            if (!response.ok) {
                // 5. Parse Actual Error
                const errorData = await response.json() as GeminiResponse;
                const errorMessage = errorData.error?.message || `API Error: ${response.status} ${response.statusText}`;
                throw new Error(errorMessage);
            }

            const data: GeminiResponse = await response.json();
            const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";

            setChatMessages(prev => [...prev, { role: 'assistant', content: aiText }]);

        } catch (error) {
            console.error("AI Chat Error:", error);

            let displayError = "AI is sleeping (Unknown Error)";
            if (error instanceof Error) {
                displayError = `Error: ${error.message}`;
            }

            setChatMessages(prev => [...prev, { role: 'assistant', content: displayError }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    // --- Token Scan Logic ---
    const checkToken = async () => {
        const normalizedAddress = contractAddress.trim().toLowerCase();

        if (!normalizedAddress.startsWith('0x') || normalizedAddress.length !== 42) {
            setError('Please enter a valid contract address (0x... + 40 chars)');
            return;
        }

        setCleanAddress(normalizedAddress);
        setLoading(true);
        setError(null);
        setAnalysis(null);
        setDexData(null);

        // Task A: DEXScreener Fetch
        const fetchDex = async (): Promise<DexPair | null> => {
            try {
                const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${normalizedAddress}`);
                if (!response.ok) return null;

                const data: DexScreenerResponse = await response.json();
                if (!data || !data.pairs || data.pairs.length === 0) return null;

                const basePair = data.pairs.find(p => p.chainId === 'base');
                return basePair || null;
            } catch (err) {
                console.error('DEXScreener Fetch Failed:', err);
                return null;
            }
        };

        // Task B: GoPlus Security Fetch
        const fetchSecurity = async (): Promise<GoPlusTokenSecurity | null> => {
            try {
                const response = await fetch(`https://api.gopluslabs.io/api/v1/token_security/${CHAIN_ID}?contract_addresses=${normalizedAddress}`);
                if (!response.ok) throw new Error(`GoPlus API error: ${response.status}`);

                const data: GoPlusResponse = await response.json();
                if (data?.result?.[normalizedAddress]) {
                    return data.result[normalizedAddress];
                }
                return null;
            } catch (err) {
                console.error('GoPlus Fetch Failed:', err);
                return null;
            }
        };

        try {
            const [dexResult, securityResult] = await Promise.all([fetchDex(), fetchSecurity()]);

            if (dexResult) setDexData(dexResult);

            if (securityResult) {
                calculateTrustScore(securityResult);
            } else {
                if (!dexResult) {
                    setError('No token data found. This address may be a wallet or unlisted.');
                } else {
                    setError('Security data unavailable, but token market data found.');
                }
            }

        } catch (err) {
            console.error('Global Fetch Error:', err);
            setError('An unexpected error occurred during the scan.');
        } finally {
            setLoading(false);
        }
    };

    const calculateTrustScore = (data: GoPlusTokenSecurity) => {
        let score = 100;

        if (data?.is_honeypot === '1') score -= 50;

        const buyTax = parseFloat(data?.buy_tax || '0');
        const sellTax = parseFloat(data?.sell_tax || '0');
        if (buyTax > 0.1 || sellTax > 0.1) score -= 20;

        if (data?.is_proxy === '1') score -= 10;

        const isRenounced = !data?.owner_address || BURN_ADDRESSES.includes(data.owner_address.toLowerCase());
        if (!isRenounced) score -= 5;

        if (data?.is_open_source === '0') score -= 15;

        setAnalysis({
            trustScore: Math.min(100, Math.max(0, score)),
            details: data,
            isRenounced
        });
    };

    return (
        <div style={{
            backgroundColor: '#0a0b0d',
            color: 'white',
            minHeight: '100vh',
            padding: '20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}>
            <div style={{ maxWidth: '420px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ textAlign: 'center', paddingTop: '40px', paddingBottom: '30px' }}>
                    <h1 style={{
                        fontSize: '32px',
                        fontWeight: '800',
                        margin: '0 0 8px 0',
                        background: 'linear-gradient(to right, #60a5fa, #ffffff)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        display: 'inline-block'
                    }}>
                        🛡️ BaseShield
                    </h1>
                    <p style={{
                        color: '#71717a',
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '2px',
                        fontWeight: '600',
                        marginTop: '0'
                    }}>
                        Elite Security Scanner
                    </p>
                </div>

                {/* Input Area */}
                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.5)',
                    padding: '8px',
                    borderRadius: '16px',
                    border: '1px solid #27272a',
                    marginBottom: '24px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
                }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            value={contractAddress}
                            onChange={(e) => setContractAddress(e.target.value)}
                            placeholder="Paste format 0x..."
                            style={{
                                flex: 1,
                                backgroundColor: '#09090b',
                                color: 'white',
                                border: '1px solid #0052FF',
                                borderRadius: '12px',
                                padding: '14px',
                                fontSize: '14px',
                                fontFamily: 'monospace',
                                outline: 'none'
                            }}
                        />
                    </div>
                    <button
                        onClick={checkToken}
                        disabled={loading}
                        style={{
                            backgroundColor: '#0052FF',
                            color: 'white',
                            fontWeight: 'bold',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '14px',
                            width: '100%',
                            marginTop: '8px',
                            cursor: loading ? 'wait' : 'pointer',
                            opacity: loading ? 0.7 : 1,
                            fontSize: '14px',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {loading ? 'SCANNING...' : 'SCAN'}
                    </button>
                    {error && (
                        <div style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            padding: '12px',
                            borderRadius: '12px',
                            marginTop: '12px',
                            fontSize: '13px'
                        }}>
                            ⚠️ {error}
                        </div>
                    )}
                </div>

                {/* Manual Link Button */}
                {cleanAddress && cleanAddress.length === 42 && (
                    <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                        <a
                            href={`https://dexscreener.com/base/${cleanAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: '#18181b',
                                color: '#a1a1aa',
                                fontSize: '12px',
                                padding: '8px 16px',
                                borderRadius: '999px',
                                textDecoration: 'none',
                                border: '1px solid #27272a',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <span>📊</span> View Data on DEXScreener
                        </a>
                    </div>
                )}

                {/* Empty State */}
                {!analysis && !loading && !dexData && (
                    <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.5 }}>
                        <div style={{ fontSize: '64px', marginBottom: '16px', filter: 'grayscale(1)' }}>🔍</div>
                        <p style={{ color: '#71717a', fontWeight: '500' }}>Ready to scan Base Network</p>
                    </div>
                )}

                {/* Token Found Card */}
                {dexData ? (
                    <div style={{
                        backgroundColor: '#16181d',
                        border: '1px solid #27272a',
                        borderRadius: '16px',
                        padding: '20px',
                        marginBottom: '20px',
                        overflow: 'hidden'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <h3 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0', color: 'white' }}>{dexData.baseToken.name}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>${dexData.baseToken.symbol}</span>
                                    {dexData.priceUsd && (
                                        <span style={{
                                            backgroundColor: '#27272a',
                                            color: '#a1a1aa',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            whiteSpace: 'nowrap',
                                            overflowWrap: 'break-word',
                                            maxWidth: '100%'
                                        }}>
                                            ${formatPrice(dexData.priceUsd)}
                                        </span>
                                    )}
                                </div>
                                {/* Socials Row */}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                                    {dexData.info?.websites?.map((site, idx) => (
                                        <a
                                            key={`web-${idx}`}
                                            href={site.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ backgroundColor: '#0052FF', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', textDecoration: 'none', fontWeight: 'bold' }}
                                        >
                                            🌐 Website
                                        </a>
                                    ))}
                                    {dexData.info?.socials?.map((social, idx) => (
                                        <a
                                            key={`social-${idx}`}
                                            href={social.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ backgroundColor: '#0052FF', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', textDecoration: 'none', fontWeight: 'bold', textTransform: 'capitalize' }}
                                        >
                                            {social.type === 'twitter' ? '🐦 Twitter' : social.type === 'telegram' ? '✈️ Telegram' : social.type}
                                        </a>
                                    ))}
                                </div>
                            </div>

                            {dexData.liquidity?.usd !== undefined ? (
                                <div style={{
                                    padding: '6px 10px',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    backgroundColor: dexData.liquidity.usd > 10000 ? 'rgba(74, 222, 128, 0.1)' : 'rgba(250, 204, 21, 0.1)',
                                    color: dexData.liquidity.usd > 10000 ? '#4ade80' : '#facc15',
                                    border: `1px solid ${dexData.liquidity.usd > 10000 ? 'rgba(74, 222, 128, 0.2)' : 'rgba(250, 204, 21, 0.2)'}`,
                                    whiteSpace: 'nowrap',
                                    marginLeft: '8px'
                                }}>
                                    Liq: ${(dexData.liquidity.usd / 1000).toFixed(1)}K
                                </div>
                            ) : null}
                        </div>

                        {/* Volume Dashboard */}
                        {dexData.volume && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '8px',
                                backgroundColor: 'rgba(24, 24, 27, 0.5)',
                                padding: '12px',
                                borderRadius: '12px',
                                borderTop: '1px solid #27272a'
                            }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', color: '#71717a' }}>5m</div>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>{formatVolume(dexData.volume.m5)}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', color: '#71717a' }}>1h</div>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>{formatVolume(dexData.volume.h1)}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', color: '#71717a' }}>6h</div>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>{formatVolume(dexData.volume.h6)}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', color: '#71717a' }}>24h</div>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>{formatVolume(dexData.volume.h24)}</div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}

                {/* Security Dashboard */}
                {analysis && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* Trust Score Card */}
                        <div style={{
                            background: 'linear-gradient(to bottom, #18181b, #0a0b0d)',
                            border: '1px solid #27272a',
                            borderRadius: '24px',
                            padding: '24px',
                            textAlign: 'center',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ fontSize: '10px', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px' }}>Trust Score</div>
                            <div style={{
                                fontSize: '56px',
                                fontWeight: '900',
                                lineHeight: '1',
                                marginBottom: '16px',
                                color: analysis.trustScore >= 80 ? '#4ade80' : analysis.trustScore >= 50 ? '#facc15' : '#ef4444',
                                textShadow: analysis.trustScore >= 80 ? '0 0 20px rgba(74, 222, 128, 0.3)' : 'none'
                            }}>
                                {analysis.trustScore}
                            </div>
                            <div style={{ height: '6px', width: '100%', backgroundColor: '#27272a', borderRadius: '999px', overflow: 'hidden', maxWidth: '200px', margin: '0 auto' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${analysis.trustScore}%`,
                                    backgroundColor: analysis.trustScore >= 80 ? '#4ade80' : analysis.trustScore >= 50 ? '#facc15' : '#ef4444',
                                    borderRadius: '999px',
                                    transition: 'width 1s ease-out'
                                }}></div>
                            </div>
                        </div>

                        {/* Status Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {/* Honeypot */}
                            <div style={{
                                padding: '16px',
                                borderRadius: '16px',
                                border: '1px solid',
                                backgroundColor: analysis.details.is_honeypot === '1' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(74, 222, 128, 0.1)',
                                borderColor: analysis.details.is_honeypot === '1' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(74, 222, 128, 0.2)'
                            }}>
                                <div style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Honeypot</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: analysis.details.is_honeypot === '1' ? '#f87171' : '#4ade80' }}>
                                    {analysis.details.is_honeypot === '1' ? 'DETECTED' : 'SAFE'}
                                </div>
                            </div>

                            {/* Taxes */}
                            <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', border: '1px solid #27272a', padding: '16px', borderRadius: '16px' }}>
                                <div style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Buy / Sell Tax</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>
                                    <span style={{ color: parseFloat(analysis.details.buy_tax) > 0.1 ? '#f87171' : '#d4d4d8' }}>{(parseFloat(analysis.details.buy_tax) * 100).toFixed(0)}%</span>
                                    <span style={{ color: '#52525b', margin: '0 4px' }}>/</span>
                                    <span style={{ color: parseFloat(analysis.details.sell_tax) > 0.1 ? '#f87171' : '#d4d4d8' }}>{(parseFloat(analysis.details.sell_tax) * 100).toFixed(0)}%</span>
                                </div>
                            </div>

                            {/* Ownership Status */}
                            <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', border: '1px solid #27272a', padding: '16px', borderRadius: '16px' }}>
                                <div style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Ownership</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                                    {analysis.isRenounced ? (
                                        <span style={{ color: '#4ade80' }}>Renounced ✅</span>
                                    ) : (
                                        <span style={{ color: '#facc15' }}>Owner Active ⚠️</span>
                                    )}
                                </div>
                            </div>

                            {/* Contract */}
                            <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', border: '1px solid #27272a', padding: '16px', borderRadius: '16px' }}>
                                <div style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Contract</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>
                                    {analysis.details.is_proxy === '1' ? (
                                        <span style={{ color: '#facc15' }}>Proxy</span>
                                    ) : (
                                        <span style={{ color: '#d4d4d8' }}>Standard</span>
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* Raw Data Toggle */}
                        <div style={{ marginTop: '16px' }}>
                            <details style={{ cursor: 'pointer' }}>
                                <summary style={{ listStyle: 'none', textAlign: 'center', fontSize: '12px', color: '#52525b', padding: '8px' }}>
                                    View Raw Data
                                </summary>
                                <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#000', borderRadius: '12px', border: '1px solid #27272a', overflow: 'hidden' }}>
                                    <pre style={{ fontSize: '10px', color: '#22c55e', margin: 0, overflow: 'auto', maxHeight: '160px' }}>
                                        {JSON.stringify(analysis.details, null, 2)}
                                    </pre>
                                </div>
                            </details>
                        </div>

                    </div>
                )}
            </div>

            {/* --- AI Chat Interface --- */}

            {/* Chat Window */}
            {isChatOpen && (
                <div style={{
                    position: 'fixed',
                    bottom: '90px',
                    right: '20px',
                    width: '380px', // Increased width
                    height: '600px', // Increased height
                    backgroundColor: '#16181d',
                    borderRadius: '16px',
                    border: '1px solid #27272a',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 1000,
                    overflow: 'hidden',
                    fontFamily: 'inherit'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '16px',
                        borderBottom: '1px solid #27272a',
                        backgroundColor: '#0a0b0d',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <div style={{
                            width: '10px',
                            height: '10px',
                            backgroundColor: '#0052FF',
                            borderRadius: '50%',
                            boxShadow: '0 0 8px #0052FF'
                        }}></div>
                        <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'white' }}>BaseShield AI</span>
                        <div style={{ marginLeft: 'auto', cursor: 'pointer', fontSize: '18px', color: '#71717a' }} onClick={() => setIsChatOpen(false)}>×</div>
                    </div>

                    {/* Messages Area */}
                    <div style={{
                        flex: 1,
                        padding: '16px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        backgroundColor: '#16181d'
                    }}>
                        {chatMessages.map((msg, idx) => (
                            <div key={idx} style={{
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '85%',
                                backgroundColor: msg.role === 'user' ? '#0052FF' : '#27272a',
                                color: 'white',
                                padding: '10px 14px',
                                borderRadius: '12px',
                                borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                                borderBottomLeftRadius: msg.role === 'assistant' ? '2px' : '12px',
                                fontSize: '13px',
                                lineHeight: '1.4'
                            }}>
                                {msg.content}
                            </div>
                        ))}
                        {isChatLoading && (
                            <div style={{
                                alignSelf: 'flex-start',
                                backgroundColor: '#27272a',
                                color: '#a1a1aa',
                                padding: '10px 14px',
                                borderRadius: '12px',
                                borderBottomLeftRadius: '2px',
                                fontSize: '12px',
                                fontStyle: 'italic'
                            }}>
                                Thinking...
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div style={{
                        padding: '12px',
                        borderTop: '1px solid #27272a',
                        backgroundColor: '#0a0b0d',
                        display: 'flex',
                        gap: '8px'
                    }}>
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Ask about this token..."
                            style={{
                                flex: 1,
                                backgroundColor: '#18181b',
                                border: '1px solid #27272a',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                color: 'white',
                                fontSize: '12px',
                                outline: 'none'
                            }}
                            disabled={isChatLoading}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={isChatLoading}
                            style={{
                                backgroundColor: isChatLoading ? '#27272a' : '#0052FF',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                cursor: 'pointer',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ➤
                        </button>
                    </div>
                </div>
            )}

            {/* Floating Action Button (FAB) */}
            <button
                onClick={toggleChat}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    backgroundColor: '#0052FF',
                    color: 'white',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0, 82, 255, 0.4)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transform: isChatOpen ? 'rotate(90deg)' : 'rotate(0deg)'
                }}
            >
                {isChatOpen ? (
                    <span style={{ fontSize: '24px', lineHeight: 1 }}>✕</span>
                ) : (
                    <span style={{ fontSize: '24px', lineHeight: 1 }}>💬</span>
                )}
            </button>

        </div>
    );
};

export default BaseShield;