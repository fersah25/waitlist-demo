import React, { useState, useEffect } from 'react';

// Types for GoPlus Response
interface GoPlusTokenSecurity {
    contract_address: string;
    is_honeypot: string; // "1" or "0"
    buy_tax: string; // e.g. "0.10" = 10%
    sell_tax: string; // e.g. "0.10" = 10%
    is_proxy: string; // "1" or "0"
    owner_address: string; // address string or ""
    lp_holder_count: string; // number as string
    is_open_source: string; // "1" or "0"
}

interface GoPlusResponse {
    code: number;
    message: string;
    result: Record<string, GoPlusTokenSecurity>;
}

interface SecurityAnalysis {
    trustScore: number;
    details: GoPlusTokenSecurity;
}

const BaseShield: React.FC = () => {
    const [contractAddress, setContractAddress] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<SecurityAnalysis | null>(null);

    // Constants
    const CHAIN_ID = '8453'; // Base Network

    // Reset analysis when address changes to prevent stale data display
    useEffect(() => {
        if (analysis && analysis.details.contract_address.toLowerCase() !== contractAddress.toLowerCase()) {
            // Optional: We could clear analysis here, but let's keep it until new search
        }
    }, [contractAddress, analysis]);

    const fetchSecurityData = async () => {
        if (!contractAddress) {
            setError('Please enter a contract address.');
            return;
        }

        // Basic address validation (starts with 0x, 42 chars)
        if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
            setError('Invalid contract address format.');
            return;
        }

        setLoading(true);
        setError(null);
        setAnalysis(null);

        try {
            const response = await fetch(`https://api.gopluslabs.io/api/v1/token_security/${CHAIN_ID}?contract_addresses=${contractAddress}`);
            const data: GoPlusResponse = await response.json();

            if (data.code !== 1 || !data.result) {
                throw new Error(data.message || 'Failed to fetch security data.');
            }

            // The API returns a map with the address (lowercase) as key
            const lowerAddr = contractAddress.toLowerCase();
            // GoPlus sometimes returns keys in lowercase. We should find the matching key.
            const resultKey = Object.keys(data.result).find(k => k.toLowerCase() === lowerAddr);
            const tokenData = resultKey ? data.result[resultKey] : null;

            if (!tokenData) {
                throw new Error('No data found for this contract.');
            }

            calculateTrustScore(tokenData);
        } catch (err: any) {
            setError(err.message || 'An error occurred while fetching data.');
        } finally {
            setLoading(false);
        }
    };

    const calculateTrustScore = (data: GoPlusTokenSecurity) => {
        let score = 100;
        const deductions: string[] = [];

        // 1. Honeypot Check
        if (data.is_honeypot === '1') {
            score -= 50;
        }

        // 2. High Tax Check (Threshold: > 10%)
        const buyTax = parseFloat(data.buy_tax || '0');
        const sellTax = parseFloat(data.sell_tax || '0');
        if (buyTax > 0.1 || sellTax > 0.1) {
            score -= 20;
        }

        // 3. Proxy Check
        if (data.is_proxy === '1') {
            score -= 10; // Proxy contracts are upgradeable, adding risk
        }

        // 4. Ownership Renounced Check (Empty address or dead address usually means renounced, but API gives owner_address)
        // If owner address exists and is not empty/null, it's not renounced.
        // However, for this simple score, let's just penalty if it's NOT renounced? 
        // Or maybe just leave it as informational. The prompt asks "Is ownership renounced?".
        // Let's penalize slightly if not renounced for a "Trust Score".
        if (data.owner_address && data.owner_address !== '0x0000000000000000000000000000000000000000') {
            score -= 5;
        }

        // 5. Open Source (Bonus/Penalty) - Not requested but good for "Trust"
        if (data.is_open_source === '0') {
            score -= 15; // Unverified source is high risk
        }

        // Ensure score doesn't go below 0
        setAnalysis({
            trustScore: Math.max(0, score),
            details: data
        });
    };

    return (
        <div className="p-6 max-w-lg mx-auto bg-gray-900 text-white rounded-xl shadow-lg border border-gray-700">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                🛡️ BaseShield <span className="text-xs bg-blue-600 px-2 py-1 rounded-full">Beta</span>
            </h2>

            {/* Input Section */}
            <div className="flex flex-col gap-3 mb-6">
                <label className="text-sm text-gray-400">Token Contract Address (Base)</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={contractAddress}
                        onChange={(e) => setContractAddress(e.target.value)}
                        placeholder="0x..."
                        className="flex-1 p-2 rounded bg-gray-800 border border-gray-600 focus:outline-none focus:border-blue-500 text-sm font-mono"
                    />
                    <button
                        onClick={fetchSecurityData}
                        disabled={loading}
                        className={`px-4 py-2 rounded font-medium transition-colors ${loading
                                ? 'bg-gray-600 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500'
                            }`}
                    >
                        {loading ? 'Scanning...' : 'Scan'}
                    </button>
                </div>
                {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
            </div>

            {/* Results Section */}
            {analysis && (
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* Trust Score Header */}
                    <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-3">
                        <span className="text-lg font-semibold">Trust Score</span>
                        <div className={`text-3xl font-bold ${analysis.trustScore >= 80 ? 'text-green-400' :
                                analysis.trustScore >= 50 ? 'text-yellow-400' :
                                    'text-red-500'
                            }`}>
                            {analysis.trustScore}/100
                        </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 gap-3 text-sm">

                        {/* Honeypot */}
                        <div className="flex justify-between items-center bg-gray-700/50 p-2 rounded">
                            <span className="text-gray-300">Is Honeypot?</span>
                            <span className={analysis.details.is_honeypot === '1' ? 'text-red-400 font-bold' : 'text-green-400'}>
                                {analysis.details.is_honeypot === '1' ? 'YES (RUN!)' : 'No'}
                            </span>
                        </div>

                        {/* Taxes */}
                        <div className="flex justify-between items-center bg-gray-700/50 p-2 rounded">
                            <span className="text-gray-300">Buy / Sell Tax</span>
                            <span className={(parseFloat(analysis.details.buy_tax) > 0.1 || parseFloat(analysis.details.sell_tax) > 0.1) ? 'text-yellow-400' : 'text-green-400'}>
                                {(parseFloat(analysis.details.buy_tax) * 100).toFixed(1)}% / {(parseFloat(analysis.details.sell_tax) * 100).toFixed(1)}%
                            </span>
                        </div>

                        {/* Proxy */}
                        <div className="flex justify-between items-center bg-gray-700/50 p-2 rounded">
                            <span className="text-gray-300">Upgradeable Proxy?</span>
                            <span className={analysis.details.is_proxy === '1' ? 'text-yellow-400' : 'text-green-400'}>
                                {analysis.details.is_proxy === '1' ? 'Yes' : 'No'}
                            </span>
                        </div>

                        {/* Ownership */}
                        <div className="flex flex-col gap-1 bg-gray-700/50 p-2 rounded">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-300">Owner Renounced?</span>
                                <span className={!analysis.details.owner_address || analysis.details.owner_address === '0x0000000000000000000000000000000000000000' ? 'text-green-400' : 'text-yellow-400'}>
                                    {(!analysis.details.owner_address || analysis.details.owner_address === '0x0000000000000000000000000000000000000000') ? 'Yes' : 'No'}
                                </span>
                            </div>
                            {analysis.details.owner_address && analysis.details.owner_address !== '0x0000000000000000000000000000000000000000' && (
                                <span className="text-xs text-gray-500 font-mono break-all">
                                    {analysis.details.owner_address}
                                </span>
                            )}
                        </div>

                        {/* LP Holders */}
                        <div className="flex justify-between items-center bg-gray-700/50 p-2 rounded">
                            <span className="text-gray-300">LP Holder Count</span>
                            <span className="font-mono">{analysis.details.lp_holder_count || 'Unknown'}</span>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default BaseShield;