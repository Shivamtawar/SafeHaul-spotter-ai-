import type { Route } from '../../shared/api/schemas'
import { formatDateTime } from '../../shared/lib/format'
import { RiskChip } from './RiskChip'

/** The map's checkpoint popups as a table: usable by keyboard and screen reader. */
export function CheckpointTable({ route, name }: { route: Route; name: string }) {
  return (
    <details className="checkpoint-details">
      <summary>
        {name} checkpoints ({route.checkpoints.length})
      </summary>
      <div className="table-scroll">
        <table>
          <caption className="visually-hidden">Weather at each checkpoint on {name}</caption>
          <thead>
            <tr>
              <th scope="col">Mile</th>
              <th scope="col">ETA</th>
              <th scope="col">Risk</th>
              <th scope="col">Wind</th>
              <th scope="col">Rain</th>
              <th scope="col">Snow</th>
            </tr>
          </thead>
          <tbody>
            {route.checkpoints.map((checkpoint) => (
              <tr key={checkpoint.mile}>
                <th scope="row">{checkpoint.mile}</th>
                <td>{formatDateTime(checkpoint.eta)}</td>
                <td>
                  <RiskChip level={checkpoint.level} />
                </td>
                <td>{checkpoint.wind_mph} mph</td>
                <td>{checkpoint.rain_in_hr} in/hr</td>
                <td>{checkpoint.snow_in_hr} in/hr</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
