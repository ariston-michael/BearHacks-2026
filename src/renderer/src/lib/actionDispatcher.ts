export type GestureAction =
	| 'click'
	| 'rightClick'
	| 'drag-start'
	| 'drag-end'
	| 'scroll'
	| 'cursor-move'

export function dispatchAction(action: GestureAction, params?: any): void {
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
			const x = typeof params?.x === 'number' ? params.x : 0
			const y = typeof params?.y === 'number' ? params.y : 0
			void window.electron.cursor.move(x, y)
			break
		}
		default:
			console.warn('[actionDispatcher] unknown action', action, params)
			break
	}
}
