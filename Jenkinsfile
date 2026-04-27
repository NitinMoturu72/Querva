pipeline {
    agent any

    environment {
        EC2_HOST = credentials('EC2_HOST')
        EC2_USER = 'ubuntu'
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out code...'
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing dependencies...'
                sh 'cd backend && npm ci'
            }
        }

        stage('Test') {
            steps {
                echo 'Running tests...'
                sh '''
                    # Start a temporary postgres container for tests
                    docker run -d \
                        --name test-postgres \
                        -e POSTGRES_USER=postgres \
                        -e POSTGRES_PASSWORD=postgres \
                        -e POSTGRES_DB=querva_test \
                        -p 5432:5432 \
                        postgres:15-alpine

                    # Wait for postgres to be ready
                    sleep 5

                    # Run tests with test database credentials
                    cd backend
                    DB_HOST=localhost \
                    DB_PORT=5432 \
                    DB_NAME=querva_test \
                    DB_USER=postgres \
                    DB_PASSWORD=postgres \
                    JWT_SECRET=test-secret-key \
                    npm test -- --watchAll=false

                    # Cleanup
                    docker stop test-postgres
                    docker rm test-postgres
                '''
            }
        }

        stage('Build Docker Images') {
            steps {
                echo 'Building Docker images...'
                sh 'docker-compose build --no-cache'
            }
        }

        stage('Deploy to EC2') {
            when {
                branch 'main'
            }
            steps {
                echo 'Deploying to EC2...'
                sshagent(['ec2-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST "
                            cd /home/ubuntu/app/Querva &&
                            git pull origin main &&
                            docker-compose down &&
                            docker-compose build --no-cache &&
                            docker-compose up -d
                        "
                    '''
                }
            }
        }

        stage('Health Check') {
            when {
                branch 'main'
            }
            steps {
                echo 'Running health checks...'
                sshagent(['ec2-ssh-key']) {
                    sh '''
                        sleep 15
                        ssh -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST "
                            STATUS=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/health)
                            echo Backend status: \$STATUS
                            if [ \"\$STATUS\" != \"200\" ]; then
                                echo Health check failed
                                exit 1
                            fi
                            echo All checks passed
                        "
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline succeeded!'
        }
        failure {
            echo 'Pipeline failed!'
        }
        always {
            node('built-in') {
                sh '''
                docker stop test-postgres 2>/dev/null || true
                docker rm test-postgres 2>/dev/null || true
                docker system prune -f
                '''
            }
        }
    }
}