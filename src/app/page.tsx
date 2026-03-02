import { readFileSync } from 'fs';
import { join } from 'path';
import WeightChart from './WeightChart';

export interface WeightEntry {
  date: string;
  weight: number;
}

export default function Home() {
  const data: WeightEntry[] = JSON.parse(
    readFileSync(join(process.cwd(), 'data', 'weights.json'), 'utf-8')
  );
  return <WeightChart data={data} />;
}
