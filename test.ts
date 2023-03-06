import { merge } from "lodash";
import {
  all,
  call,
  debounce,
  put,
  select,
  takeLatest,
} from "redux-saga/effects";

// Define an interface for the events in the batch
type GAEvent = {
  name: string;
};

interface GAEventPayload {
  eventName: string;
  eventPayload: GAEvent;
}
// Define an interface for the batch state
interface BatchState {
  [eventName: string]: GAEvent | undefined;
}

// Define an action to add an event to the batch
interface AddEventAction {
  type: "ADD_EVENT";
  payload: GAEventPayload;
}

// Define an action to send the batch to dataLayer and clear it
interface SendBatchAction {
  type: "SEND_BATCH";
}

// Define an action to clear the batch
interface ClearBatchAction {
  type: "CLEAR_BATCH";
}

// Define an action to update the batch for a given event name
interface UpdateBatchAction {
  type: "UPDATE_BATCH";
  payload: {
    eventName: string;
    event: GAEvent;
  };
}

// Define a function to calculate the size of an object in bytes
function getObjectSize(obj: object): number {
  return new Blob([JSON.stringify(obj)]).size;
}

// Define a saga to add an event to the batch
function* addEventSaga(action: AddEventAction) {
  const { eventName, eventPayload } = action.payload;
  const storedEvent: BatchState = yield select(
    (state: { batch: BatchState }) => state.batch[eventName]
  );

  const mergedEvent = storedEvent
    ? merge(storedEvent, eventPayload)
    : eventPayload;
  const batchSize = getObjectSize(mergedEvent);

  if (batchSize > 6500) {
    // The new event would make the batch too large, send it now and clear the batch
    yield call(sendBatchSaga);
  }
  yield put({
    type: "UPDATE_BATCH",
    payload: { eventName, event: mergedEvent },
  });
  yield put({
    type: `ADD_EVENT_${eventName}`,
    payload: { eventName, event: mergedEvent },
  });
}

function* sendEventSaga(action: AddEventAction) {
  const { eventName } = action.payload;
  const batchedEvent: BatchState = yield select(
    (state: { batch: BatchState }) => state.batch[eventName]
  );

  if (!batchedEvent) return;

  console.log(batchedEvent);

  yield put({
    type: "UPDATE_BATCH",
    payload: { eventName, event: undefined },
  });
}

// Define a saga to send the batch to dataLayer and clear it
function* sendBatchSaga() {
  const batch: BatchState = yield select(
    (state: { batch: BatchState }) => state.batch
  );
  yield put({ type: "CLEAR_BATCH" });
  for (const eventName of Object.keys(batch)) {
    const event = batch[eventName];
    if (event) {
      console.log(event);
    }
  }
}

// Define a saga to wait for 5 seconds and then send the batch
function* sendBatchAfterDelaySaga(eventName: string) {
  yield debounce(5000, `ADD_EVENT_${eventName}`, sendEventSaga);
}

// function* setupSaga(eventName: string) {
//   yield all([
//     takeLatest("ADD_EVENT", (action: AddEventAction) => {
//       if (action.payload.eventName === eventName) {
//         return addEventSaga(action);
//       }
//     }),
//     sendBatchAfterDelaySaga(eventName),
//   ]);
// }

// Define the root saga to run all sagas
export default function* rootSaga() {
  yield all([
    takeLatest("ADD_EVENT", addEventSaga),
    sendBatchAfterDelaySaga("A"),
    sendBatchAfterDelaySaga("B"),
  ]);
  yield takeLatest("SEND_ALL_EVENTS", sendBatchSaga);
}

// Create the initial batch state
const initialState: BatchState = {};

// Define a reducer for the batch state
export function batchReducer(
  state: BatchState = initialState,
  action: UpdateBatchAction | ClearBatchAction
): BatchState {
  switch (action.type) {
    case "UPDATE_BATCH":
      return { ...state, [action.payload.eventName]: action.payload.event };
    case "CLEAR_BATCH":
      return {};
    default:
      return state;
  }
}
