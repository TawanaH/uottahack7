import { useLocation } from "react-router";
import { useNavigate } from "react-router";

const location = useLocation()
const state = location.state || {}


export default function () {
    return (
        <div>
            Loading
        </div>
    )
}