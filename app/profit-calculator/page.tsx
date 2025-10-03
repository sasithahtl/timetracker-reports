'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type TeamMember = {
	id: number;
	name: string;
	login: string;
};

type TimeEntry = {
	user_id: number;
	project_id: number | null;
	billable: number;
	duration: string | null;
};

type ApiEntry = {
	user_id: number;
	project_id: number | null;
	billable: number;
	duration: string | null;
};

type ManualRow = { id: string; description: string; amount: number };
type ExtraHourRow = { id: string; user_id: number | null; hours: number };

function durationToHours(duration: string | null): number {
	if (!duration) return 0;
	const [h, m] = duration.split(':').map(Number);
	return (h || 0) + ((m || 0) / 60);
}

export default function ProfitCalculatorPage() {
	const [allUsers, setAllUsers] = useState<TeamMember[]>([]);
	const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
	const [allProjects, setAllProjects] = useState<{ id: number; name: string }[]>([]);
	const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
	const [dateFrom, setDateFrom] = useState<string>(() => {
		const d = new Date(), y = d.getFullYear(), m = d.getMonth();
		return new Date(y, m, 1).toISOString().split('T')[0];
	});
	const [dateTo, setDateTo] = useState<string>(() => {
		const d = new Date(), y = d.getFullYear(), m = d.getMonth();
		return new Date(y, m + 1, 0).toISOString().split('T')[0];
	});

	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [clientRate, setClientRate] = useState<number>(25); // AUD per hour
	const [userRates, setUserRates] = useState<Record<number, number>>({}); // per-user cost rate (AUD/hr)

	const [otherIncomes, setOtherIncomes] = useState<ManualRow[]>([]);
	const [expenses, setExpenses] = useState<ManualRow[]>([]);
	const [extraHours, setExtraHours] = useState<ExtraHourRow[]>([]);

	const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);

	useEffect(() => {
		loadUsers();
		loadProjects();
	}, []);

	useEffect(() => {
		if (selectedUsers.length > 0) {
			loadTimeEntries();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [dateFrom, dateTo, selectedUsers]);

	async function loadUsers() {
		try {
			setIsLoading(true);
			setError(null);
			const res = await fetch(`/api/database?action=teamSummary&date_from=${dateFrom}&date_to=${dateTo}`);
			if (!res.ok) throw new Error('Failed to load users');
			const data = await res.json();
			const users: TeamMember[] = data.users || [];
			setAllUsers(users);
			if (users.length > 0) {
				setSelectedUsers(users.map((u) => u.id));
				// initialize default user rates if not set
				setUserRates((prev) => {
					const next = { ...prev };
					const inferDefaultRate = (name: string): number => {
						const n = (name || '').toLowerCase();
						if (n.includes('ravindu')) return 7.58;
						if (n.includes('amila')) return 10.97;
						if (n.includes('sasitha')) return 15.96;
						return 0;
					};
					users.forEach((u) => {
						if (next[u.id] === undefined) next[u.id] = inferDefaultRate(u.name);
					});
					return next;
				});
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to load users');
		} finally {
			setIsLoading(false);
		}
	}

	async function loadProjects() {
		try {
			const res = await fetch(`/api/database?action=projects`);
			if (!res.ok) throw new Error('Failed to load projects');
			const projects: { id: number; name: string }[] = await res.json();
			const simplified = (projects || []).map((p) => ({ id: Number(p.id), name: String(p.name) }));
			setAllProjects(simplified);
			setSelectedProjects(simplified.map((p: { id: number }) => p.id));
		} catch {
			// ignore
		}
	}

	async function loadTimeEntries() {
		try {
			setIsLoading(true);
			setError(null);
			const params = new URLSearchParams();
			params.set('action', 'filteredEntries');
			params.set('date_from', dateFrom);
			params.set('date_to', dateTo);
			// always fetch all; project filter applies to income only
			// multiple users: we will fetch once without filtering and aggregate on FE
			const res = await fetch(`/api/database?${params.toString()}`);
			if (!res.ok) throw new Error('Failed to load time entries');
			const entries: ApiEntry[] = await res.json();
			const simplified: TimeEntry[] = entries.map((e) => ({
				user_id: e.user_id,
				project_id: e.project_id,
				billable: e.billable,
				duration: e.duration,
			}));
			setTimeEntries(simplified);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to load time entries');
		} finally {
			setIsLoading(false);
		}
	}

	function toggleUser(userId: number) {
		setSelectedUsers((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
	}

	function setRateForUser(userId: number, rate: number) {
		setUserRates((prev) => ({ ...prev, [userId]: isNaN(rate) ? 0 : rate }));
	}

	function toggleProject(projectId: number) {
		setSelectedProjects((prev) => prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]);
	}

	function addOtherIncome() {
		setOtherIncomes((rows) => [...rows, { id: crypto.randomUUID(), description: '', amount: 0 }]);
	}
	function updateOtherIncome(id: string, patch: Partial<ManualRow>) {
		setOtherIncomes((rows) => rows.map((r) => r.id === id ? { ...r, ...patch } : r));
	}
	function removeOtherIncome(id: string) {
		setOtherIncomes((rows) => rows.filter((r) => r.id !== id));
	}

	function addExpense() {
		setExpenses((rows) => [...rows, { id: crypto.randomUUID(), description: '', amount: 0 }]);
	}
	function updateExpense(id: string, patch: Partial<ManualRow>) {
		setExpenses((rows) => rows.map((r) => r.id === id ? { ...r, ...patch } : r));
	}
	function removeExpense(id: string) {
		setExpenses((rows) => rows.filter((r) => r.id !== id));
	}

	function addExtraHourRow() {
		setExtraHours((rows) => [...rows, { id: crypto.randomUUID(), user_id: selectedUsers[0] ?? (allUsers[0]?.id ?? null), hours: 0 }]);
	}
	function updateExtraHourRow(id: string, patch: Partial<ExtraHourRow>) {
		setExtraHours((rows) => rows.map((r) => r.id === id ? { ...r, ...patch } : r));
	}
	function removeExtraHourRow(id: string) {
		setExtraHours((rows) => rows.filter((r) => r.id !== id));
	}

const extraByUser = useMemo(() => {
    const map: Record<number, number> = {};
    extraHours.forEach((r) => {
        if (!r.user_id) return;
        const uid = Number(r.user_id);
        const h = Number(r.hours) || 0;
        if (!isFinite(h) || h <= 0) return;
        map[uid] = (map[uid] || 0) + h;
    });
    return map;
}, [extraHours]);

const perUserIncomeHours = useMemo(() => {
    const byUser: Record<number, number> = {};
    selectedUsers.forEach((id) => { byUser[id] = 0; });
    const allSelected = selectedProjects.length === 0 || selectedProjects.length === allProjects.length;
    const projectSet = new Set(selectedProjects);
    timeEntries.forEach((e) => {
        const billableOk = e.billable === 1;
        const projectOk = allSelected ? true : (e.project_id != null && projectSet.has(e.project_id));
        if (billableOk && projectOk && selectedUsers.includes(e.user_id)) {
            byUser[e.user_id] = (byUser[e.user_id] || 0) + durationToHours(e.duration);
        }
    });
    // add extra billable hours per user
    Object.keys(extraByUser).forEach((k) => {
        const uid = Number(k);
        if (selectedUsers.includes(uid)) {
            byUser[uid] = (byUser[uid] || 0) + (extraByUser[uid] || 0);
        }
    });
    return byUser;
}, [timeEntries, selectedUsers, selectedProjects, allProjects.length, extraByUser]);

const perUserCostHours = useMemo(() => {
    const byUser: Record<number, number> = {};
    selectedUsers.forEach((id) => { byUser[id] = 0; });
    timeEntries.forEach((e) => {
        if (selectedUsers.includes(e.user_id)) {
            byUser[e.user_id] = (byUser[e.user_id] || 0) + durationToHours(e.duration);
        }
    });
    // add extra hours to cost-hours as well (cost is at user rates)
    Object.keys(extraByUser).forEach((k) => {
        const uid = Number(k);
        if (selectedUsers.includes(uid)) {
            byUser[uid] = (byUser[uid] || 0) + (extraByUser[uid] || 0);
        }
    });
    return byUser;
}, [timeEntries, selectedUsers, extraByUser]);

const incomeFromClient = useMemo(() => {
    const totalChargedHours = Object.values(perUserIncomeHours).reduce((a, b) => a + b, 0);
    return totalChargedHours * clientRate;
}, [perUserIncomeHours, clientRate]);

	const otherIncomeTotal = useMemo(() => otherIncomes.reduce((s, r) => s + (Number(r.amount) || 0), 0), [otherIncomes]);
	const expensesTotal = useMemo(() => expenses.reduce((s, r) => s + (Number(r.amount) || 0), 0), [expenses]);

const perUserCost = useMemo(() => {
		const map: Record<number, number> = {};
    Object.entries(perUserCostHours).forEach(([uid, hours]) => {
			const id = Number(uid);
			const rate = userRates[id] || 0;
			map[id] = hours * rate;
		});
		return map;
}, [perUserCostHours, userRates]);

	const totalCost = useMemo(() => Object.values(perUserCost).reduce((a, b) => a + b, 0), [perUserCost]);
	const totalIncome = useMemo(() => incomeFromClient + otherIncomeTotal, [incomeFromClient, otherIncomeTotal]);
	const totalExpenses = useMemo(() => totalCost + expensesTotal, [totalCost, expensesTotal]);
	const profit = useMemo(() => totalIncome - totalExpenses, [totalIncome, totalExpenses]);

// derived selections (if needed later)

	const formatCurrency = useMemo(() => (n: number) => '$' + (n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), []);

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-10 w-full">
			<div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8">
				<div className="mb-8 flex items-center justify-between">
					<div>
						<Link href="/" className="text-blue-600 hover:text-blue-800 text-base font-medium">Back to Home</Link>
						<h1 className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">Profit Calculator</h1>
						<p className="mt-1 text-slate-600">Compute (AUD) $ income, costs, expenses and profit for a period</p>
					</div>
					<div>
						<button
							onClick={() => { loadUsers(); loadTimeEntries(); }}
							disabled={isLoading}
							className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-blue-700 disabled:opacity-50"
						>
							{isLoading ? 'Loading...' : 'Refresh'}
						</button>
					</div>
				</div>
				{error && (
					<div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6 text-red-800">{error}</div>
				)}

				<div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 mb-8">
					<h2 className="text-xl font-semibold text-slate-900 mb-4">Filters</h2>
					<div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
						<div>
							<label className="block text-sm font-semibold text-slate-700 mb-2">Date From</label>
							<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50" />
						</div>
						<div>
							<label className="block text-sm font-semibold text-slate-700 mb-2">Date To</label>
							<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50" />
						</div>
						<div>
							<label className="block text-sm font-semibold text-slate-700 mb-2">Client Rate ($/hr)</label>
							<input type="number" step="0.01" value={clientRate} onChange={(e) => setClientRate(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
						</div>
						<div className="flex items-end">
							<button onClick={loadTimeEntries} disabled={isLoading} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-blue-700 disabled:opacity-50 w-full">Update</button>
						</div>
					</div>
					<div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
						<div className="lg:col-span-3">
							<div className="flex items-center justify-between mb-2">
								<h3 className="text-sm font-semibold text-slate-800">Projects</h3>
								<div className="flex gap-3 text-sm">
									<button onClick={() => setSelectedProjects(allProjects.map(p => p.id))} className="text-blue-600 hover:text-blue-800">Select all</button>
									<button onClick={() => setSelectedProjects([])} className="text-blue-600 hover:text-blue-800">Deselect all</button>
								</div>
							</div>
							<div className="bg-slate-50 rounded-lg p-3 border border-slate-200 max-h-56 overflow-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
								{allProjects.map((p) => (
									<label key={p.id} className="flex items-center gap-2 text-sm">
										<input type="checkbox" checked={selectedProjects.includes(p.id)} onChange={() => toggleProject(p.id)} />
										<span className="text-slate-700">{p.name}</span>
									</label>
								))}
							</div>
						</div>
					</div>
				</div>

				<div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 mb-8">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-xl font-semibold text-slate-900">Team Members & Cost Rate ($/hr)</h2>
						<div className="flex gap-3">
							<button onClick={() => setSelectedUsers(allUsers.map((u) => u.id))} className="text-sm text-blue-600 hover:text-blue-800">Select all</button>
							<button onClick={() => setSelectedUsers([])} className="text-sm text-blue-600 hover:text-blue-800">Deselect all</button>
						</div>
					</div>
					<div className="overflow-x-auto">
						<table className="min-w-full">
							<thead className="bg-slate-100">
								<tr>
									<th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Select</th>
									<th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">User</th>
									<th className="px-4 py-2 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Income Hours</th>
									<th className="px-4 py-2 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Cost Hours</th>
									<th className="px-4 py-2 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Cost Rate ($/hr)</th>
									<th className="px-4 py-2 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Cost ($)</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{allUsers.map((u) => {
									const selected = selectedUsers.includes(u.id);
									const incomeHours = perUserIncomeHours[u.id] || 0;
									const costHours = (perUserCostHours as Record<number, number>)[u.id] || 0;
									const rate = userRates[u.id] || 0;
									const cost = costHours * rate;
									return (
										<tr key={u.id} className={selected ? 'bg-white' : 'bg-slate-50'}>
											<td className="px-4 py-2"><input type="checkbox" checked={selected} onChange={() => toggleUser(u.id)} /></td>
											<td className="px-4 py-2 text-sm text-slate-800">{u.name}</td>
											<td className="px-4 py-2 text-right text-sm text-slate-800">{incomeHours.toFixed(2)}</td>
											<td className="px-4 py-2 text-right text-sm text-slate-800">{costHours.toFixed(2)}</td>
											<td className="px-4 py-2 text-right">
												<input
													type="number"
													step="0.01"
													value={rate}
													onChange={(e) => setRateForUser(u.id, Number(e.target.value))}
													className="w-28 border border-slate-300 rounded px-2 py-1 text-right"
												/>
											</td>
											<td className="px-4 py-2 text-right text-sm font-medium text-slate-900">{formatCurrency(cost)}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-xl font-semibold text-slate-900">Extra Billable Hours</h2>
							<button onClick={addExtraHourRow} className="bg-green-600 text-white px-3 py-1.5 rounded-md text-sm">Add</button>
						</div>
						<table className="min-w-full">
							<thead className="bg-slate-100">
								<tr>
									<th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">User</th>
									<th className="px-3 py-2 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Hours</th>
									<th className="px-3 py-2"></th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{extraHours.map((row) => (
									<tr key={row.id}>
										<td className="px-3 py-2">
											<select
												value={row.user_id ?? ''}
												onChange={(e) => updateExtraHourRow(row.id, { user_id: e.target.value ? Number(e.target.value) : null })}
												className="w-full border border-slate-300 rounded px-2 py-1"
											>
												<option value="">Select user</option>
												{allUsers.map(u => (
													<option key={u.id} value={u.id}>{u.name}</option>
												))}
											</select>
										</td>
										<td className="px-3 py-2 text-right">
											<input type="number" step="0.01" value={row.hours}
												onChange={(e) => updateExtraHourRow(row.id, { hours: Number(e.target.value) })}
												className="w-32 border border-slate-300 rounded px-2 py-1 text-right" />
										</td>
										<td className="px-3 py-2 text-right"><button onClick={() => removeExtraHourRow(row.id)} className="text-red-600">Remove</button></td>
									</tr>
								))}
								{extraHours.length === 0 && (
									<tr>
										<td className="px-3 py-3 text-sm text-slate-500" colSpan={3}>No extra hours. Click Add.</td>
									</tr>
								)}
							</tbody>
						</table>
						<div className="mt-3 text-right text-sm text-slate-700">Total extra hours income: <span className="font-semibold">{Object.values(extraByUser).reduce((a,b)=>a+b,0).toFixed(2)} h</span></div>
					</div>
					<div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-xl font-semibold text-slate-900">Other Incomes ($)</h2>
							<button onClick={addOtherIncome} className="bg-green-600 text-white px-3 py-1.5 rounded-md text-sm">Add</button>
						</div>
						<table className="min-w-full">
							<thead className="bg-slate-100">
								<tr>
									<th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Description</th>
									<th className="px-3 py-2 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Amount</th>
									<th className="px-3 py-2"></th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{otherIncomes.map((row) => (
									<tr key={row.id}>
										<td className="px-3 py-2">
											<input value={row.description} onChange={(e) => updateOtherIncome(row.id, { description: e.target.value })} className="w-full border border-slate-300 rounded px-2 py-1" />
										</td>
										<td className="px-3 py-2 text-right">
											<input type="number" step="0.01" value={row.amount} onChange={(e) => updateOtherIncome(row.id, { amount: Number(e.target.value) })} className="w-32 border border-slate-300 rounded px-2 py-1 text-right" />
										</td>
										<td className="px-3 py-2 text-right"><button onClick={() => removeOtherIncome(row.id)} className="text-red-600">Remove</button></td>
									</tr>
								))}
								{otherIncomes.length === 0 && (
									<tr>
										<td className="px-3 py-3 text-sm text-slate-500" colSpan={3}>No other incomes. Click Add.</td>
									</tr>
								)}
							</tbody>
						</table>
						<div className="mt-3 text-right text-sm text-slate-700">Total other income: <span className="font-semibold">{formatCurrency(otherIncomeTotal)}</span></div>
					</div>

					<div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-xl font-semibold text-slate-900">Expenses ($)</h2>
							<button onClick={addExpense} className="bg-green-600 text-white px-3 py-1.5 rounded-md text-sm">Add</button>
						</div>
						<table className="min-w-full">
							<thead className="bg-slate-100">
								<tr>
									<th className="px-3 py-2 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Description</th>
									<th className="px-3 py-2 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Amount</th>
									<th className="px-3 py-2"></th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{expenses.map((row) => (
									<tr key={row.id}>
										<td className="px-3 py-2">
											<input value={row.description} onChange={(e) => updateExpense(row.id, { description: e.target.value })} className="w-full border border-slate-300 rounded px-2 py-1" />
										</td>
										<td className="px-3 py-2 text-right">
											<input type="number" step="0.01" value={row.amount} onChange={(e) => updateExpense(row.id, { amount: Number(e.target.value) })} className="w-32 border border-slate-300 rounded px-2 py-1 text-right" />
										</td>
										<td className="px-3 py-2 text-right"><button onClick={() => removeExpense(row.id)} className="text-red-600">Remove</button></td>
									</tr>
								))}
								{expenses.length === 0 && (
									<tr>
										<td className="px-3 py-3 text-sm text-slate-500" colSpan={3}>No expenses. Click Add.</td>
									</tr>
								)}
							</tbody>
						</table>
						<div className="mt-3 text-right text-sm text-slate-700">Total expenses: <span className="font-semibold">{formatCurrency(expensesTotal)}</span></div>
					</div>
				</div>

				<div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden mt-8">
					<div className="p-6 border-b border-slate-200">
						<h2 className="text-2xl font-bold text-slate-900">Summary</h2>
						<p className="text-slate-600 mt-1">All values in Australian dollars ($)</p>
					</div>
					<div className="p-6">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
							<div>
								<h3 className="text-lg font-semibold text-slate-900 mb-3">Income</h3>
								<div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
									<div className="flex items-center justify-between text-sm mb-2">
										<span>Client billed hours x rate</span>
									<span>{formatCurrency(incomeFromClient)}</span>
									</div>
									{otherIncomes.map((r, i) => (
										<div key={r.id} className="flex items-center justify-between text-sm">
											<span>Other income {i + 1}: {r.description || '—'}</span>
										<span>{formatCurrency(Number(r.amount) || 0)}</span>
										</div>
									))}
									<div className="border-t border-slate-200 mt-3 pt-3 flex items-center justify-between font-semibold">
										<span>Total Income</span>
									<span>{formatCurrency(totalIncome)}</span>
									</div>
								</div>
							</div>
							<div>
								<h3 className="text-lg font-semibold text-slate-900 mb-3">Expenses</h3>
								<div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
									{allUsers.filter(u => selectedUsers.includes(u.id)).map(u => (
										<div key={u.id} className="flex items-center justify-between text-sm">
											<span>{u.name} cost</span>
										<span>{formatCurrency(perUserCost[u.id] || 0)}</span>
										</div>
									))}
									{expenses.map((r, i) => (
										<div key={r.id} className="flex items-center justify-between text-sm">
											<span>Expense {i + 1}: {r.description || '—'}</span>
										<span>{formatCurrency(Number(r.amount) || 0)}</span>
										</div>
									))}
									<div className="border-t border-slate-200 mt-3 pt-3 flex items-center justify-between font-semibold">
										<span>Total Expenses</span>
									<span>{formatCurrency(totalExpenses)}</span>
									</div>
								</div>
							</div>
						</div>

						<div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
							<div className="bg-green-50 border border-green-200 rounded-lg p-4">
								<div className="text-sm text-green-800">Total Income</div>
							<div className="text-2xl font-bold text-green-900">{formatCurrency(totalIncome)}</div>
							</div>
							<div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
								<div className="text-sm text-amber-800">Total Expenses</div>
							<div className="text-2xl font-bold text-amber-900">{formatCurrency(totalExpenses)}</div>
							</div>
							<div className={`rounded-lg p-4 ${profit >= 0 ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'}`}>
								<div className={`text-sm ${profit >= 0 ? 'text-blue-800' : 'text-red-800'}`}>{profit >= 0 ? 'Profit' : 'Loss'}</div>
							<div className={`text-2xl font-bold ${profit >= 0 ? 'text-blue-900' : 'text-red-900'}`}>{formatCurrency(profit)}</div>
							</div>
						<div className="col-span-1 lg:col-span-3">
							{/* <button
								onClick={async () => {
									try {
										const payload = {
											dateFrom,
											dateTo,
											clientRate,
											users: allUsers.filter(u => selectedUsers.includes(u.id)).map(u => ({ id: u.id, name: u.name })),
											perUserIncomeHours,
											perUserCostHours,
											userRates,
											otherIncomes,
											expenses,
											selectedProjectNames: allProjects.filter(p => selectedProjects.includes(p.id)).map(p => p.name),
										};
										const res = await fetch('/api/export-excel', {
											method: 'POST',
											headers: { 'Content-Type': 'application/json' },
											body: JSON.stringify(payload),
										});
										if (!res.ok) throw new Error('Export failed');
										const blob = await res.blob();
										const url = URL.createObjectURL(blob);
										const a = document.createElement('a');
										a.href = url;
										a.download = `profit_${dateFrom}_to_${dateTo}.xlsx`;
										a.click();
										URL.revokeObjectURL(url);
									} catch (err) {
										alert(err instanceof Error ? err.message : 'Export failed');
									}
								}}
								className="mt-4 bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold shadow hover:bg-emerald-700"
							>
								Download Excel (with formulas)
							</button> */}
							<button
								onClick={async () => {
									try {
										const payload = {
											dateFrom,
											dateTo,
											clientRate,
											users: allUsers.filter(u => selectedUsers.includes(u.id)).map(u => ({ id: u.id, name: u.name })),
											perUserIncomeHours,
											perUserCostHours,
											userRates,
											otherIncomes,
											expenses,
											selectedProjectNames: allProjects.filter(p => selectedProjects.includes(p.id)).map(p => p.name),
										};
										const res = await fetch('/api/export-profit-pdf', {
											method: 'POST',
											headers: { 'Content-Type': 'application/json' },
											body: JSON.stringify(payload),
										});
										if (!res.ok) throw new Error('PDF generate failed');
										const data = await res.json();
										const win = window.open('', '_blank');
										if (win) {
											win.document.open();
											win.document.write(data.html);
											win.document.close();
										}
									} catch (err) {
										alert(err instanceof Error ? err.message : 'PDF generate failed');
									}
								}}
								className="mt-4 ml-3 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold shadow hover:bg-purple-700"
							>
								Open Print View (Save as PDF)
							</button>
						</div>
					</div>
				</div>
				</div>
		</div>
	</div>
	);
}


