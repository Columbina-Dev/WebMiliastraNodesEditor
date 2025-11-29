if [[ "$VERCEL_GIT_COMMIT_REF" == "main" || "$VERCEL_GIT_COMMIT_REF" == "beta" ]] ; then
  echo "main / beta branch allowed"
  exit 1;
else
  echo "Branch ignored"
  exit 0;
fi
