import { createBrowserRouter } from "react-router";
import Home from "./pages/Home";
import ChooseTopic from "./pages/ChooseTopic";
import Assessment from "./pages/Assessment";
import Results from "./pages/Results";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/choose-topic",
    Component: ChooseTopic,
  },
  {
    path: "/assessment/:topic",
    Component: Assessment,
  },
  {
    path: "/results",
    Component: Results,
  },
]);