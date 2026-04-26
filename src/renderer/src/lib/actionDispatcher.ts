export type GestureAction =
	| 'click'
	| 'rightClick'
	| 'drag-start'
	| 'drag-end'
	| 'scroll'
	| 'cursor-move'

type GestureActionParams = number | { deltaY?: unknown; x?: unknown; y?: unknown }

export function dispatchAction(action: GestureAction, params?: GestureActionParams): void {
	switch (action) {
		case 'click':
			void window.electron.cursor.click()
			break
		case 'rightClick':
			void window.electron.cursor.rightClick()
			break
		case 'drag-start':
			console.log('[actionDispatcher] drag-start (not mapped to system control)')
			break
		case 'drag-end':
			console.log('[actionDispatcher] drag-end (not mapped to system control)')
			break
		case 'scroll': {
			const deltaY =
				typeof params === 'number' ? params : typeof params?.deltaY === 'number' ? params.deltaY : 0
			void window.electron.cursor.scroll(deltaY)
			break
		}
		case 'cursor-move': {
			const moveParams = typeof params === 'object' && params !== null ? params : {}
			const x = typeof moveParams.x === 'number' ? moveParams.x : 0
			const y = typeof moveParams.y === 'number' ? moveParams.y : 0
			void window.electron.cursor.move(x, y)
			break
		}
		default:
			console.warn('[actionDispatcher] unknown action', action, params)
			break
	}
}
