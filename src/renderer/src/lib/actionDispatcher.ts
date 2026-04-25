export type GestureAction =
	| 'click'
	| 'rightClick'
	| 'drag-start'
	| 'drag-end'
	| 'scroll'
	| 'cursor-move'

export function dispatchAction(action: GestureAction, params?: any): void {
	// TODO: Replace console logs with Electron IPC calls once renderer-to-main wiring is ready.
	switch (action) {
		case 'click':
			console.log('[actionDispatcher] click')
			break
		case 'rightClick':
			console.log('[actionDispatcher] rightClick')
			break
		case 'drag-start':
			console.log('[actionDispatcher] drag-start')
			break
		case 'drag-end':
			console.log('[actionDispatcher] drag-end')
			break
		case 'scroll':
			console.log('[actionDispatcher] scroll', params)
			break
		case 'cursor-move':
			console.log('[actionDispatcher] cursor-move', params)
			break
		default:
			console.warn('[actionDispatcher] unknown action', action, params)
			break
	}
}
