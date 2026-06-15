import { STATE_MACHINES } from '../config/stateMachines.js'

export class StateMachineError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
    this.name = 'StateMachineError'
  }
}

export function getStateMachine(type) {
  const machine = STATE_MACHINES[type]
  if (!machine) throw new StateMachineError(`Unknown ticket type: ${type}`, 500)
  return machine
}

export function canTransition(type, fromStatus, transitionName, userRole) {
  const machine = getStateMachine(type)
  const transition = machine.transitions[transitionName]
  if (!transition) return false

  const fromMatches = transition.from === '*' || transition.from === fromStatus
  if (!fromMatches) return false

  return transition.roles.includes(userRole)
}

export function applyTransition(type, fromStatus, transitionName, userRole) {
  const machine = getStateMachine(type)
  const transition = machine.transitions[transitionName]
  if (!transition) {
    throw new StateMachineError(`Unknown transition '${transitionName}' for ${type}`)
  }

  const fromMatches = transition.from === '*' || transition.from === fromStatus
  if (!fromMatches) {
    throw new StateMachineError(
      `Cannot '${transitionName}' from status '${fromStatus}' (expected '${transition.from}')`
    )
  }

  if (!transition.roles.includes(userRole)) {
    throw new StateMachineError(
      `Role '${userRole}' not authorized for '${transitionName}' transition`
    )
  }

  return transition.to
}

export function getAvailableTransitions(type, fromStatus, userRole) {
  const machine = getStateMachine(type)
  return Object.entries(machine.transitions)
    .filter(([, t]) => {
      const fromMatches = t.from === '*' || t.from === fromStatus
      return fromMatches && t.roles.includes(userRole)
    })
    .map(([name]) => name)
}

export function getInitialState(type) {
  return getStateMachine(type).initial
}
