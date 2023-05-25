import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  LinearProgress,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

export const PoolDisplayCard = () => {
  // TODO: query the pool
  const poolValue = 100000;
  return (
    <Box sx={{ minWidth: 275 }}>
      <Card title="Pool" variant="outlined">
        <>
          <CardContent>
            <Typography
              sx={{ fontSize: 14 }}
              color="text.secondary"
              gutterBottom
            >
              Pool
            </Typography>
            <Typography variant="h5" component="div">
              {poolValue}
            </Typography>
          </CardContent>
          <CardActions>
            <Button size="small">Learn More</Button>
          </CardActions>
        </>
      </Card>
    </Box>
  );
};

// Component that renders a timer to Christmas day UTC.
export const DistributionTicker = () => {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      const christmas = new Date(now.getUTCFullYear(), 11, 25);
      if (now.getUTCMonth() === 11 && now.getUTCDate() > 25) {
        christmas.setUTCFullYear(christmas.getUTCFullYear() + 1);
      }
      const timeRemaining = christmas.getTime() - now.getTime();

      // Calculate remaining days, hours, minutes, and seconds
      const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor(
        (timeRemaining % (1000 * 60 * 60)) / (1000 * 60)
      );
      const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

      // Format the countdown string
      const countdownString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
      setCountdown(countdownString);
    };

    const interval = setInterval(calculateCountdown, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <Box sx={{ minWidth: 275 }}>
      <Card title="Pool" variant="outlined">
        <>
          <CardContent>
            <Typography
              sx={{ fontSize: 14 }}
              color="text.secondary"
              gutterBottom
            >
              Time till distribution
            </Typography>
            {countdown === "" ? (
              <LinearProgress
                color="secondary"
                style={{ justifyContent: "center" }}
              />
            ) : (
              <Typography variant="h5" component="div">
                {countdown}
              </Typography>
            )}
          </CardContent>
        </>
      </Card>
    </Box>
  );
};
