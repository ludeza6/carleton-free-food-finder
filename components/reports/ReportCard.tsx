import { FoodReport } from "@/types/report";

function quantityLabel(quantity: FoodReport["quantity"]) {
  switch (quantity) {
    case "lots":
      return "Lots available";
    case "some":
      return "Some available";
    case "almost_gone":
      return "Almost gone";
  }
}

export default function ReportCard({
  report,
}: {
  report: FoodReport;
}) {
  return (
    <article className="rounded-lg border p-4">
      <h3 className="text-lg font-semibold">
        {report.food_type}
      </h3>

      <p>
        {report.building}
        {report.room && ` · Room ${report.room}`}
      </p>

      <p className="mt-2">{quantityLabel(report.quantity)}</p>

      {report.notes && (
        <p className="mt-2 text-sm">{report.notes}</p>
      )}
    </article>
  );
}